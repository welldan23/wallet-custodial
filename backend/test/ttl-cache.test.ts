import { describe, expect, it } from 'vitest';

import { TtlCache } from '../src/lib/ttl-cache.js';

describe('TtlCache', () => {
  it('memakai hasil yang sama selama belum kedaluwarsa', async () => {
    let now = 0;
    const cache = new TtlCache<number>(1_000, 100, () => now);
    let loads = 0;
    const load = async () => ++loads;

    expect(await cache.getOrLoad('a', load)).toBe(1);
    now = 999;
    expect(await cache.getOrLoad('a', load)).toBe(1);
    now = 1_000;
    expect(await cache.getOrLoad('a', load)).toBe(2);
  });

  it('permintaan bersamaan cukup satu kali muat', async () => {
    const cache = new TtlCache<number>(1_000);
    let loads = 0;
    const load = () => new Promise<number>((resolve) => setTimeout(() => resolve(++loads), 10));
    const [a, b] = await Promise.all([cache.getOrLoad('k', load), cache.getOrLoad('k', load)]);
    expect([a, b, loads]).toEqual([1, 1, 1]);
  });

  it('pemuatan yang gagal tidak disimpan', async () => {
    const cache = new TtlCache<number>(1_000);
    await expect(cache.getOrLoad('k', () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(await cache.getOrLoad('k', async () => 7)).toBe(7);
  });

  it('membatasi jumlah entri', async () => {
    const cache = new TtlCache<number>(60_000, 3);
    for (let i = 0; i < 10; i += 1) await cache.getOrLoad(`k${i}`, async () => i);
    expect(cache.size).toBe(3);
  });
});
