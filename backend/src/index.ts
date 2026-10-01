import { serve } from '@hono/node-server';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';

import { createApp } from './app.js';
import { BalanceCache } from './cache/balance-cache.js';
import { SqliteBalanceStore } from './cache/balance-store.js';
import { loadCatalog } from './catalog/repository.js';
import { createBalanceReaders } from './chains/readers.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db/database.js';
import { seedCatalog } from './db/seed.js';
import { PriceService } from './prices/price-service.js';
import {
  coinGeckoSource,
  defiLlamaSource,
  frankfurterFxSource,
  openErApiFxSource,
} from './prices/sources.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const config = loadConfig();
const db = openDatabase(config.databasePath);
seedCatalog(db);

if (!config.cacheKeySecret) {
  console.warn(
    '[cache] CACHE_KEY_SECRET kosong: pakai kunci acak, cache saldo tidak terpakai lagi setelah restart.',
  );
}
const balanceStore = new SqliteBalanceStore(db);
const balanceCache = new BalanceCache({
  store: balanceStore,
  ttlMs: config.balanceCacheTtlMs,
  maxStaleMs: config.balanceMaxStaleMs,
  ownerKeySecret: config.cacheKeySecret ?? randomBytes(32).toString('hex'),
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
