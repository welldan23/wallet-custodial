import { loadCatalog } from '../src/catalog/repository.js';
import type { BalanceReader, RawBalance } from '../src/chains/types.js';
import { openDatabase, type Db } from '../src/db/database.js';
import { seedCatalog } from '../src/db/seed.js';
import { TtlCache } from '../src/lib/ttl-cache.js';
import type { BalanceSummaryDeps } from '../src/services/balance-summary.js';
import type { Token } from '../src/types.js';

export const EVM_OWNER = '0x1111111111111111111111111111111111111111';
export const SOLANA_OWNER = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

export function seededDb(): Db {
  const db = openDatabase(':memory:');
  seedCatalog(db, { now: new Date('2026-10-01T10:42:00.000Z') });
  return db;
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

export function makeDeps(
  db: Db,
  readers: Record<string, BalanceReader>,
  overrides: Partial<BalanceSummaryDeps> = {},
): BalanceSummaryDeps {
  return {
    loadCatalog: () => loadCatalog(db),
    readers: new Map(Object.entries(readers)),
    cache: new TtlCache(20_000),
    rpcTimeoutMs: 1_000,
    now: () => new Date('2026-10-01T11:00:00.000Z'),
    ...overrides,
  };
}
