import { describe, expect, it } from 'vitest';

import {
  coinGeckoSource,
  defiLlamaSource,
  frankfurterFxSource,
  openErApiFxSource,
  type FetchLike,
} from '../src/prices/sources.js';

function fakeFetch(body: unknown, status = 200) {
  const requests: { url: string; headers: Record<string, string> }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    requests.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    return new Response(JSON.stringify(body), { status });
  };
  return { fetchImpl, requests };
}

describe('defiLlamaSource', () => {
  it('mengambil semua simbol dalam satu request dan membuang data meragukan', async () => {
    const { fetchImpl, requests } = fakeFetch({
      coins: {
        'coingecko:usd-coin': { price: 0.9998, confidence: 0.99 },
        'coingecko:ethereum': { price: 2715.16, confidence: 0.99 },
        'coingecko:solana': { price: 119.2, confidence: 0.2 },
        'coingecko:tether': { price: 'bukan angka' },
      },
    });
    const prices = await defiLlamaSource({ fetchImpl }).fetchUsdPrices([
      'USDC',
      'ETH',
      'SOL',
      'USDT',
      'TIDAKDIKENAL',
    ]);

    expect(Object.fromEntries(prices)).toEqual({ USDC: 0.9998, ETH: 2715.16 });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      'https://coins.llama.fi/prices/current/coingecko:usd-coin,coingecko:ethereum,coingecko:solana,coingecko:tether',
    );
  });

  it('melempar error kalau HTTP gagal', async () => {
    const { fetchImpl } = fakeFetch({}, 503);
    await expect(defiLlamaSource({ fetchImpl }).fetchUsdPrices(['ETH'])).rejects.toThrow(
      'HTTP 503',
    );
  });
});

describe('coinGeckoSource', () => {
  it('memakai API key demo kalau ada', async () => {
    const { fetchImpl, requests } = fakeFetch({ 'polygon-ecosystem-token': { usd: 0.1137 } });
    const prices = await coinGeckoSource({ fetchImpl, apiKey: 'demo-key' }).fetchUsdPrices(['POL']);

    expect(Object.fromEntries(prices)).toEqual({ POL: 0.1137 });
    expect(requests[0]?.url).toContain('ids=polygon-ecosystem-token&vs_currencies=usd');
    expect(requests[0]?.headers['x-cg-demo-api-key']).toBe('demo-key');
  });
});

describe('sumber kurs', () => {
  it('frankfurter membaca kurs IDR', async () => {
    const { fetchImpl } = fakeFetch({ base: 'USD', rates: { IDR: 17891 } });
    expect(await frankfurterFxSource({ fetchImpl }).fetchUsdToIdr()).toBe(17891);
  });

  it('menolak kurs di luar rentang wajar', async () => {
    const { fetchImpl } = fakeFetch({ rates: { IDR: 1.0 } });
    await expect(frankfurterFxSource({ fetchImpl }).fetchUsdToIdr()).rejects.toThrow('Kurs IDR');
  });

  it('open.er-api hanya diterima kalau result = success', async () => {
    const ok = fakeFetch({ result: 'success', rates: { IDR: 17903.53 } });
    expect(await openErApiFxSource({ fetchImpl: ok.fetchImpl }).fetchUsdToIdr()).toBe(17903.53);

    const failed = fakeFetch({ result: 'error', rates: { IDR: 17903.53 } });
    await expect(
      openErApiFxSource({ fetchImpl: failed.fetchImpl }).fetchUsdToIdr(),
    ).rejects.toThrow();
  });
});
