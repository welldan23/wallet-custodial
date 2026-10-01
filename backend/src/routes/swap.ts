import { Hono } from 'hono';

import type { Catalog } from '../catalog/repository.js';
import type { ChainType, SwapProvider } from '../types.js';

export type SwapRouteDeps = {
  loadCatalog: () => Catalog;
};

export type SwapToken = {
  tokenId: string;
  symbol: string;
  name: string;
  decimals: number;
  /** Alamat kontrak (EVM) / mint (Solana). */
  contractAddress: string;
};

export type SwapNetwork = {
  id: string;
  name: string;
  chainType: ChainType;
  /** Agregator untuk swap di dalam jaringan ini. */
  sameChainProvider: SwapProvider;
  tokens: SwapToken[];
};

/** Agregator per tipe jaringan (PRD: LI.FI/0x untuk EVM, Jupiter untuk Solana). */
export const SAME_CHAIN_PROVIDER: Record<ChainType, SwapProvider> = {
  evm: 'lifi',
  solana: 'jupiter',
};
/** Swap beda jaringan (termasuk EVM ↔ Solana) lewat bridge LI.FI. */
export const BRIDGE_PROVIDER: SwapProvider = 'lifi';

/**
 * Stablecoin yang bisa ditukar, per jaringan aktif (urut `sort_order`).
 * Hanya token tampil yang bertanda stablecoin dan punya alamat kontrak;
 * jaringan tanpa stablecoin tidak ikut.
 */
export function listSwapNetworks(catalog: Catalog): SwapNetwork[] {
  return catalog.networks
    .filter((network) => network.isActive)
    .map((network) => ({
      id: network.id,
      name: network.name,
      chainType: network.chainType,
      sameChainProvider: SAME_CHAIN_PROVIDER[network.chainType],
      tokens: catalog.tokens
        .filter(
          (token) =>
            token.networkId === network.id &&
            token.isVisible &&
            token.isStablecoin &&
            token.contractAddress !== null,
        )
        .map((token) => ({
          tokenId: token.id,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          contractAddress: token.contractAddress!,
        })),
    }))
    .filter((network) => network.tokens.length > 0);
}

/** /v1/swap — data untuk halaman Swap. */
export function swapRoutes(deps: SwapRouteDeps): Hono {
  const app = new Hono();

  /** GET /v1/swap/tokens — stablecoin yang bisa ditukar per jaringan (data publik). */
  app.get('/tokens', (c) => {
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({
      networks: listSwapNetworks(deps.loadCatalog()),
      bridgeProvider: BRIDGE_PROVIDER,
    });
  });

  return app;
}
