import { BalanceCache, type BalanceCacheOptions } from '../src/cache/balance-cache.js';
import { SqliteBalanceStore } from '../src/cache/balance-store.js';
import { loadCatalog } from '../src/catalog/repository.js';
import type { BalanceReader, RawBalance } from '../src/chains/types.js';
import { openDatabase, type Db } from '../src/db/database.js';
import { seedCatalog } from '../src/db/seed.js';
import type { BalanceSummaryDeps } from '../src/services/balance-summary.js';
import type { Token } from '../src/types.js';

export const EVM_OWNER = '0x1111111111111111111111111111111111111111';
export const SOLANA_OWNER = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

export const TEST_PRICES_AT = '2026-10-01T10:42:00.000Z';

/** Database berisi katalog MVP + harga tes yang tetap (tidak ikut harga seed). */
export function seededDb(): Db {
  const db = openDatabase(':memory:');
  seedCatalog(db);
  setPrices(
    db,
    { USDC: 1, USDT: 1, DAI: 1, ETH: 2980.5, POL: 0.42, SOL: 152.3 },
    16350,
    TEST_PRICES_AT,
  );
  return db;
}

export function setPrices(
  db: Db,
  usdBySymbol: Record<string, number>,
  idrRate: number,
  updatedAt: string,
): void {
  const update = db.prepare(
    'UPDATE prices SET usd_price = ?, idr_rate = ?, updated_at = ? WHERE symbol = ?',
  );
  for (const [symbol, usdPrice] of Object.entries(usdBySymbol)) {
    update.run(usdPrice, idrRate, updatedAt, symbol);
  }
}

/** Pembaca palsu: saldo diambil dari tabel tokenId → raw, sisanya 0. */
export function fakeReader(rawByTokenId: Record<string, bigint>) {
  const calls: Token[][] = [];
  const reader: BalanceReader = {
    async read(_owner, tokens) {
      calls.push(tokens);
      return tokens.map((token) => ({ tokenId: token.id, raw: rawByTokenId[token.id] ?? 0n }));
    },
  };
  return { reader, calls };
}

export function failingReader(error: Error = new Error('boom')): BalanceReader {
  return { read: () => Promise.reject(error) };
}

export function hangingReader(): BalanceReader {
  return { read: () => new Promise<RawBalance[]>(() => {}) };
}

export const TEST_NOW = new Date('2026-10-01T11:00:00.000Z');

/** Cache saldo di atas SQLite tes, dengan jam yang bisa diatur. */
export function makeBalanceCache(
  db: Db,
  overrides: Partial<BalanceCacheOptions> = {},
): BalanceCache {
  return new BalanceCache({
    store: new SqliteBalanceStore(db),
    ttlMs: 20_000,
    maxStaleMs: 24 * 60 * 60_000,
    ownerKeySecret: 'rahasia-tes',
    now: () => TEST_NOW,
    ...overrides,
  });
}

export function makeDeps(
  db: Db,
  readers: Record<string, BalanceReader>,
  overrides: Partial<BalanceSummaryDeps> = {},
): BalanceSummaryDeps {
  return {
    loadCatalog: () => loadCatalog(db),
    readers: new Map(Object.entries(readers)),
    balanceCache: makeBalanceCache(db),
    rpcTimeoutMs: 1_000,
    now: () => TEST_NOW,
    ...overrides,
  };
}
