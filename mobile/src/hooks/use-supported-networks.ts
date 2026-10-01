import { useMemo } from 'react';

import { MOCK_NETWORKS, MOCK_TOKENS } from '@/mocks/wallet';
import type { Network } from '@/types/wallet';

export type SupportedNetwork = {
  network: Network;
  /** Simbol aset yang bisa diterima di jaringan ini, stablecoin dulu. */
  symbols: string[];
};

/** Jaringan aktif beserta aset yang didukung di masing-masing jaringan. */
export function useSupportedNetworks(): SupportedNetwork[] {
  return useMemo(
    () =>
      MOCK_NETWORKS.filter((network) => network.isActive).map((network) => {
        const tokens = MOCK_TOKENS.filter(
          (token) => token.networkId === network.id && token.isVisible,
        ).sort((a, b) => Number(b.isStablecoin) - Number(a.isStablecoin));
        return { network, symbols: [...new Set(tokens.map((token) => token.symbol))] };
      }),
    [],
  );
}
