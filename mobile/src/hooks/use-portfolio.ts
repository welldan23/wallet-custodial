import { useMemo } from 'react';

import { buildPortfolio } from '@/lib/portfolio';
import {
  getMockBalances,
  MOCK_FX_RATES,
  MOCK_NETWORKS,
  MOCK_PRICES,
  MOCK_TOKENS,
} from '@/mocks/wallet';

const ACTIVE_NETWORKS = MOCK_NETWORKS.filter((network) => network.isActive);

/**
 * Data saldo untuk Home. Sementara masih dari data tiruan; nanti diganti
 * ke API backend (token, harga, kurs) + RPC (saldo) tanpa mengubah UI.
 */
export function usePortfolio() {
  const portfolio = useMemo(
    () =>
      buildPortfolio({
        networks: MOCK_NETWORKS,
        tokens: MOCK_TOKENS,
        prices: MOCK_PRICES,
        balances: getMockBalances(),
      }),
    [],
  );

  // String ISO dengan format sama bisa dibandingkan langsung.
  const pricesUpdatedAt = MOCK_PRICES.reduce(
    (latest, price) => (price.updatedAt > latest ? price.updatedAt : latest),
    '',
  );

  return {
    portfolio,
    networks: ACTIVE_NETWORKS,
    fxRates: MOCK_FX_RATES,
    pricesUpdatedAt,
    isLoading: false,
  };
}
