import { serve } from '@hono/node-server';
import { existsSync } from 'node:fs';

import { createApp } from './app.js';
import { loadCatalog } from './catalog/repository.js';
import { createBalanceReaders } from './chains/readers.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db/database.js';
import { seedCatalog } from './db/seed.js';
import { TtlCache } from './lib/ttl-cache.js';
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
  cache: new TtlCache(config.balanceCacheTtlMs),
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
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
