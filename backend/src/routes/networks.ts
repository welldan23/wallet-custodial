import { Hono } from 'hono';

import type { Catalog } from '../catalog/repository.js';
import type { ChainType } from '../types.js';

export type NetworksRouteDeps = {
  loadCatalog: () => Catalog;
};

export type SupportedAsset = {
  tokenId: string;
  symbol: string;
  name: string;
  decimals: number;
  isStablecoin: boolean;
  /** `true` untuk koin gas bawaan jaringan (tanpa alamat kontrak). */
  isNative: boolean;
  /** Alamat kontrak (EVM) / mint (Solana); `null` untuk koin gas. */
  contractAddress: string | null;
};

export type SupportedNetwork = {
  id: string;
  name: string;
  chainId: string;
  chainType: ChainType;
  nativeSymbol: string;
  explorerUrl: string;
  /** Aset yang bisa diterima di jaringan ini: stablecoin dulu, lalu koin gas. */
  assets: SupportedAsset[];
};

/** Jaringan aktif (urut `sort_order`) beserta aset tampil yang bisa diterima. */
export function listSupportedNetworks(catalog: Catalog): SupportedNetwork[] {
  return catalog.networks
    .filter((network) => network.isActive)
    .map((network) => ({
      id: network.id,
      name: network.name,
      chainId: network.chainId,
      chainType: network.chainType,
      nativeSymbol: network.nativeSymbol,
      explorerUrl: network.explorerUrl,
      assets: catalog.tokens
        .filter((token) => token.networkId === network.id && token.isVisible)
        // sort stabil: urutan katalog tetap dipakai di dalam kelompok yang sama
        .sort((a, b) => Number(b.isStablecoin) - Number(a.isStablecoin))
        .map((token) => ({
          tokenId: token.id,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          isStablecoin: token.isStablecoin,
          isNative: token.contractAddress === null,
          contractAddress: token.contractAddress,
        })),
    }));
}

/** GET /v1/networks — jaringan yang didukung + aset yang bisa diterima (data publik). */
export function networksRoutes(deps: NetworksRouteDeps): Hono {
  const app = new Hono();

  app.get('/', (c) => {
    // Katalog jarang berubah dan sama untuk semua pengguna.
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ networks: listSupportedNetworks(deps.loadCatalog()) });
  });

  return app;
}
