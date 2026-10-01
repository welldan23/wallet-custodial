import { describe, expect, it } from 'vitest';

import { loadCatalog } from '../src/catalog/repository.js';
import { PriceService, type PriceServiceOptions } from '../src/prices/price-service.js';
import type { FxSource, UsdPriceSource } from '../src/prices/sources.js';

import { seededDb, TEST_PRICES_AT } from './helpers.js';

function priceSource(name: string, prices: Record<string, number> | Error) {
  const calls: string[][] = [];
  const source: UsdPriceSource = {
    name,
    async fetchUsdPrices(symbols) {
      calls.push(symbols);
      if (prices instanceof Error) throw prices;
      return new Map(Object.entries(prices).filter(([symbol]) => symbols.includes(symbol)));
    },
  };
  return { source, calls };
}

function fxSource(name: string, rate: number | Error) {
  let calls = 0;
  const source: FxSource = {
    name,
    async fetchUsdToIdr() {
      calls += 1;
      if (rate instanceof Error) throw rate;
      return rate;
    },
  };
  return { source, calls: () => calls };
}

const ALL = { DAI: 1, ETH: 2715.16, POL: 0.1138, SOL: 119.23, USDC: 0.9998, USDT: 0.9996 };
const NOW = new Date('2026-10-01T12:00:00.000Z');

function makeService(overrides: Partial<PriceServiceOptions>) {
  const db = seededDb();
  const service = new PriceService({
    db,
    priceSources: [priceSource('utama', ALL).source],
    fxSources: [fxSource('kurs', 17891).source],
    fxRefreshIntervalMs: 60 * 60_000,
    now: () => NOW,
    log: () => {},
    ...overrides,
  });
  return { db, service };
}

describe('PriceService.refresh', () => {
  it('memperbarui harga USD dan kurs IDR di database', async () => {
    const { db, service } = makeService({});
    const result = await service.refresh();

    expect(result).toEqual({
      updated: ['DAI', 'ETH', 'POL', 'SOL', 'USDC', 'USDT'],
      missing: [],
      idrRate: 17891,
      fxSource: 'kurs',
    });
    expect(loadCatalog(db).pricesBySymbol.get('ETH')).toEqual({
      symbol: 'ETH',
      usdPrice: 2715.16,
      idrRate: 17891,
      updatedAt: NOW.toISOString(),
    });
  });

  it('memakai sumber cadangan hanya untuk simbol yang belum dapat', async () => {
    const primary = priceSource('utama', { ETH: 2715.16, USDC: 0.9998 });
    const backup = priceSource('cadangan', ALL);
    const { service } = makeService({ priceSources: [primary.source, backup.source] });

    const result = await service.refresh();
    expect(result.missing).toEqual([]);
    expect(backup.calls).toEqual([['DAI', 'POL', 'SOL', 'USDT']]);
  });

  it('kalau semua sumber harga gagal, harga lama tidak diubah', async () => {
    const { db, service } = makeService({
      priceSources: [priceSource('utama', new Error('down')).source],
    });

    const result = await service.refresh();
    expect(result.updated).toEqual([]);
    expect(result.missing).toHaveLength(6);
    expect(loadCatalog(db).pricesBySymbol.get('ETH')).toMatchObject({
      usdPrice: 2980.5,
      updatedAt: TEST_PRICES_AT,
    });
  });

  it('kalau semua sumber kurs gagal, pakai kurs terakhir yang tersimpan', async () => {
    const { service } = makeService({
      fxSources: [fxSource('a', new Error('x')).source, fxSource('b', new Error('y')).source],
    });
    const result = await service.refresh();
    expect(result).toMatchObject({ idrRate: 16350, fxSource: null });
    expect(result.updated).toHaveLength(6);
  });

  it('kurs cukup diambil sekali per interval, dengan cadangan kalau sumber utama gagal', async () => {
    let now = NOW;
    const primary = fxSource('utama', new Error('down'));
    const backup = fxSource('cadangan', 17903.53);
    const { service } = makeService({
      fxSources: [primary.source, backup.source],
      now: () => now,
    });

    expect((await service.refresh()).fxSource).toBe('cadangan');
    now = new Date(NOW.getTime() + 30 * 60_000);
    expect((await service.refresh()).fxSource).toBeNull();
    expect(backup.calls()).toBe(1);

    now = new Date(NOW.getTime() + 61 * 60_000);
    expect((await service.refresh()).fxSource).toBe('cadangan');
    expect(backup.calls()).toBe(2);
  });

  it('panggilan bersamaan berbagi satu putaran refresh', async () => {
    const primary = priceSource('utama', ALL);
    const { service } = makeService({ priceSources: [primary.source] });
    await Promise.all([service.refresh(), service.refresh(), service.refresh()]);
    expect(primary.calls).toHaveLength(1);
  });
});
