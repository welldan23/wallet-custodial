import { serve } from '@hono/node-server';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { keccak256 } from 'viem';

import { createApp } from './app.js';
import { BalanceCache } from './cache/balance-cache.js';
import { SqliteBalanceStore } from './cache/balance-store.js';
import { loadCatalog } from './catalog/repository.js';
import { createBalanceReaders } from './chains/readers.js';
import { createTokenAccountOwnerResolver } from './chains/solana.js';
import { ContactStore } from './contacts/store.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db/database.js';
import { createFeeEstimators } from './fees/estimators.js';
import { createWalletKey } from './lib/wallet-key.js';
import { seedCatalog } from './db/seed.js';
import { PriceService } from './prices/price-service.js';
import {
  coinGeckoSource,
  defiLlamaSource,
  frankfurterFxSource,
  openErApiFxSource,
} from './prices/sources.js';
import { createBroadcasters } from './transactions/broadcasters.js';
import { solanaSignatureOf } from './transactions/decode-solana.js';
import { TransactionStore } from './transactions/store.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const config = loadConfig();
const db = openDatabase(config.databasePath);
seedCatalog(db);

if (!config.cacheKeySecret) {
  console.warn(
    '[cache] CACHE_KEY_SECRET kosong: pakai kunci acak, cache saldo & riwayat tidak terhubung lagi setelah restart.',
  );
}
// Kunci yang sama untuk cache saldo dan riwayat transaksi (alamat tidak disimpan).
const ownerKeySecret = config.cacheKeySecret ?? randomBytes(32).toString('hex');
const balanceStore = new SqliteBalanceStore(db);
const balanceCache = new BalanceCache({
  store: balanceStore,
  ttlMs: config.balanceCacheTtlMs,
  maxStaleMs: config.balanceMaxStaleMs,
  ownerKeySecret,
});
const purgeOldBalances = () => {
  const removed = balanceStore.purgeOlderThan(
    new Date(Date.now() - config.balanceCacheRetentionMs),
  );
  if (removed > 0) console.log(`[cache] ${removed} baris saldo lama dihapus`);
};
purgeOldBalances();
const purgeTimer = setInterval(purgeOldBalances, 60 * 60_000);
purgeTimer.unref();

const sourceOptions = { timeoutMs: config.priceFetchTimeoutMs };
const priceService = new PriceService({
  db,
  priceSources: [
    defiLlamaSource(sourceOptions),
    coinGeckoSource({ ...sourceOptions, apiKey: config.coingeckoApiKey ?? undefined }),
  ],
  fxSources: [frankfurterFxSource(sourceOptions), openErApiFxSource(sourceOptions)],
  fxRefreshIntervalMs: config.fxRefreshIntervalMs,
});
const stopPriceRefresh = priceService.start(config.priceRefreshIntervalMs);

const app = createApp({
  loadCatalog: () => loadCatalog(db),
  readers: createBalanceReaders(loadCatalog(db).networks, config.rpcUrls),
  feeEstimators: createFeeEstimators(loadCatalog(db).networks, config.rpcUrls),
  contactStore: new ContactStore(db),
  transactions: {
    broadcasters: createBroadcasters(loadCatalog(db).networks, config.rpcUrls, {
      evm: (serialized) => keccak256(serialized as `0x${string}`),
      solana: solanaSignatureOf,
    }),
    transactionStore: new TransactionStore(db),
    walletKey: createWalletKey(ownerKeySecret),
    resolveTokenAccountOwner: config.rpcUrls.solana
      ? createTokenAccountOwnerResolver(config.rpcUrls.solana)
      : undefined,
  },
  balanceCache,
  rpcTimeoutMs: config.rpcTimeoutMs,
  priceStaleAfterMs: config.priceStaleAfterMs,
  // Cukup id jaringan + nama error: pesan asli bisa memuat URL RPC (dan API key).
  onNetworkError: (networkId, error) =>
    console.warn(`[rpc] ${networkId} gagal: ${error instanceof Error ? error.name : 'unknown'}`),
});

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`MyWallet API jalan di http://localhost:${info.port}`);
});

const shutdown = () => {
  stopPriceRefresh();
  clearInterval(purgeTimer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
