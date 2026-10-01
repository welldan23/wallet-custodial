import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { MVP_NETWORKS } from '../src/catalog/mvp.js';
import type { SupportedNetwork } from '../src/routes/networks.js';

import { makeDeps, seededDb } from './helpers.js';

function testApp(db = seededDb()) {
  return createApp({ ...makeDeps(db, {}), priceStaleAfterMs: 15 * 60_000, logRequests: false });
}

async function getNetworks(db = seededDb()) {
  const res = await testApp(db).request('/v1/networks', {
    headers: { Origin: 'https://contoh.app' },
  });
  return { res, body: (await res.json()) as { networks: SupportedNetwork[] } };
}

describe('GET /v1/networks', () => {
  it('mengembalikan jaringan aktif sesuai urutan katalog, bisa di-cache publik', async () => {
    const { res, body } = await getNetworks();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(body.networks.map((network) => network.id)).toEqual(
      MVP_NETWORKS.map((network) => network.id),
    );
  });

  it('aset per jaringan: stablecoin dulu, koin gas terakhir, token tersembunyi tidak ikut', async () => {
    const { body } = await getNetworks();
    const ethereum = body.networks.find((network) => network.id === 'ethereum')!;
    expect(ethereum.assets.map((asset) => asset.symbol)).toEqual(['USDC', 'USDT', 'ETH']);
    expect(ethereum.assets.some((asset) => asset.symbol === 'DAI')).toBe(false);

    const eth = ethereum.assets.at(-1)!;
    expect(eth).toMatchObject({ isNative: true, contractAddress: null, decimals: 18 });
    const usdc = ethereum.assets[0]!;
    expect(usdc).toMatchObject({ isNative: false, isStablecoin: true, decimals: 6 });
    expect(usdc.contractAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);

    const solana = body.networks.find((network) => network.id === 'solana')!;
    expect(solana).toMatchObject({ chainType: 'solana', nativeSymbol: 'SOL' });
    expect(solana.assets.map((asset) => asset.symbol)).toEqual(['USDC', 'USDT', 'SOL']);
  });

  it('jaringan nonaktif disembunyikan, token yang dibuat tampil ikut muncul', async () => {
    const db = seededDb();
    db.prepare("UPDATE networks SET is_active = 0 WHERE id = 'polygon'").run();
    db.prepare("UPDATE tokens SET is_visible = 1 WHERE id = 'dai-ethereum'").run();

    const { body } = await getNetworks(db);
    expect(body.networks.map((network) => network.id)).not.toContain('polygon');
    const ethereum = body.networks.find((network) => network.id === 'ethereum')!;
    expect(ethereum.assets.map((asset) => asset.symbol)).toEqual(['USDC', 'USDT', 'DAI', 'ETH']);
  });

  it('hanya menerima GET lewat CORS', async () => {
    const res = await testApp().request('/v1/networks', {
      method: 'OPTIONS',
      headers: { Origin: 'https://contoh.app', 'Access-Control-Request-Method': 'POST' },
    });
    expect(res.headers.get('access-control-allow-methods')).toBe('GET');
  });
});
