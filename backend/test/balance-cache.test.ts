import { describe, expect, it } from 'vitest';

import { SqliteBalanceStore } from '../src/cache/balance-store.js';

import { EVM_OWNER, makeBalanceCache, seededDb, TEST_NOW } from './helpers.js';

const TOKENS = ['usdc-ethereum', 'eth-ethereum'];
const balances = (usdc: bigint, eth: bigint) => [
  { tokenId: 'usdc-ethereum', raw: usdc },
  { tokenId: 'eth-ethereum', raw: eth },
];

describe('SqliteBalanceStore', () => {
  it('menyimpan bigint besar tanpa kehilangan presisi dan bisa menghapus data lama', () => {
    const store = new SqliteBalanceStore(seededDb());
    const huge = 123_456_789_012_345_678_901_234_567_890n;

    store.set('ethereum', 'kunci', balances(1n, huge), '2026-10-01T00:00:00.000Z');
    expect(store.get('ethereum', 'kunci')).toEqual({
      balances: balances(1n, huge),
      fetchedAt: '2026-10-01T00:00:00.000Z',
    });
    expect(store.get('ethereum', 'lain')).toBeNull();

    expect(store.purgeOlderThan(new Date('2026-10-02T00:00:00.000Z'))).toBe(2);
    expect(store.get('ethereum', 'kunci')).toBeNull();
  });
});

describe('BalanceCache', () => {
  it('alamat disimpan sebagai HMAC, bukan alamat asli', async () => {
    const db = seededDb();
    const cache = makeBalanceCache(db);
    await cache.load('ethereum', EVM_OWNER, TOKENS, async () => balances(1n, 2n));

    const rows = db.prepare('SELECT owner_key FROM balance_cache').all() as { owner_key: string }[];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.owner_key).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows)).not.toContain(EVM_OWNER.slice(2));
    expect(makeBalanceCache(db, { ownerKeySecret: 'kunci-lain' }).ownerKey(EVM_OWNER)).not.toBe(
      cache.ownerKey(EVM_OWNER),
    );
  });

  it('bertahan setelah "restart" selama kuncinya sama', async () => {
    const db = seededDb();
    await makeBalanceCache(db).load('ethereum', EVM_OWNER, TOKENS, async () => balances(5n, 6n));

    let fetches = 0;
    const afterRestart = await makeBalanceCache(db).load(
      'ethereum',
      EVM_OWNER,
      TOKENS,
      async () => {
        fetches += 1;
        return balances(0n, 0n);
      },
    );
    expect(afterRestart).toMatchObject({ source: 'cache', balances: balances(5n, 6n) });
    expect(fetches).toBe(0);
  });

  it('membaca ulang kalau sudah lewat TTL atau ada token baru di katalog', async () => {
    const db = seededDb();
    let now = TEST_NOW;
    const cache = makeBalanceCache(db, { now: () => now, ttlMs: 20_000 });
    await cache.load('ethereum', EVM_OWNER, TOKENS, async () => balances(1n, 1n));

    now = new Date(TEST_NOW.getTime() + 21_000);
    const expired = await cache.load('ethereum', EVM_OWNER, TOKENS, async () => balances(2n, 2n));
    expect(expired.source).toBe('rpc');

    const withNewToken = await cache.load(
      'ethereum',
      EVM_OWNER,
      [...TOKENS, 'usdt-ethereum'],
      async () => [...balances(3n, 3n), { tokenId: 'usdt-ethereum', raw: 7n }],
    );
    expect(withNewToken.source).toBe('rpc');
  });

  it('RPC gagal tanpa data tersimpan → error diteruskan', async () => {
    const cache = makeBalanceCache(seededDb());
    await expect(
      cache.load('ethereum', EVM_OWNER, TOKENS, () => Promise.reject(new Error('down'))),
    ).rejects.toThrow('down');
  });

  it('permintaan bersamaan cukup satu kali baca RPC', async () => {
    const cache = makeBalanceCache(seededDb());
    let fetches = 0;
    const fetchFresh = () =>
      new Promise<ReturnType<typeof balances>>((resolve) =>
        setTimeout(() => {
          fetches += 1;
          resolve(balances(1n, 1n));
        }, 10),
      );
    await Promise.all([
      cache.load('ethereum', EVM_OWNER, TOKENS, fetchFresh),
      cache.load('ethereum', EVM_OWNER, TOKENS, fetchFresh),
    ]);
    expect(fetches).toBe(1);
  });
});
