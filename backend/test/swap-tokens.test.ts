import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { MVP_NETWORKS } from '../src/catalog/mvp.js';
import type { SwapNetwork } from '../src/routes/swap.js';

import { makeDeps, seededDb } from './helpers.js';

async function getTokens(db = seededDb()) {
  const app = createApp({ ...makeDeps(db, {}), priceStaleAfterMs: 60_000, logRequests: false });
  const res = await app.request('/v1/swap/tokens');
  return { res, body: (await res.json()) as { networks: SwapNetwork[]; bridgeProvider: string } };
}

describe('GET /v1/swap/tokens', () => {
  it('stablecoin per jaringan + penyedia, urut katalog, bisa di-cache publik', async () => {
    const { res, body } = await getTokens();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    expect(body.bridgeProvider).toBe('lifi');
    expect(body.networks.map((network) => network.id)).toEqual(MVP_NETWORKS.map((n) => n.id));

    const bySymbols = Object.fromEntries(
      body.networks.map((network) => [network.id, network.tokens.map((token) => token.symbol)]),
    );
    expect(bySymbols).toEqual({
      ethereum: ['USDC', 'USDT'],
      arbitrum: ['USDC', 'USDT'],
      base: ['USDC'],
      polygon: ['USDC', 'USDT'],
      solana: ['USDC', 'USDT'],
    });

    const providers = Object.fromEntries(
      body.networks.map((network) => [network.id, network.sameChainProvider]),
    );
    expect(providers).toMatchObject({ arbitrum: 'lifi', solana: 'jupiter' });
  });

  it('koin gas, token tersembunyi, dan jaringan nonaktif tidak ikut', async () => {
    const db = seededDb();
    db.prepare("UPDATE networks SET is_active = 0 WHERE id = 'polygon'").run();
    db.prepare("UPDATE tokens SET is_visible = 0 WHERE id = 'usdc-base'").run();
    const { body } = await getTokens(db);
    const ids = body.networks.map((network) => network.id);
    expect(ids).not.toContain('polygon');
    // Base tidak punya stablecoin lagi → tidak ikut sama sekali.
    expect(ids).not.toContain('base');
    for (const network of body.networks) {
      for (const token of network.tokens) {
        expect(token.contractAddress).toBeTruthy();
        expect(['USDC', 'USDT']).toContain(token.symbol);
      }
    }
  });
});
