import { useMemo } from 'react';

import { buildPortfolio } from '@/lib/portfolio';
import {
  MOCK_BALANCES,
  MOCK_FX_RATES,
  MOCK_NETWORKS,
  MOCK_PRICES,
  MOCK_TOKENS,
} from '@/mocks/wallet';

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
        balances: MOCK_BALANCES,
      }),
    [],
  );

  return { portfolio, fxRates: MOCK_FX_RATES, isLoading: false };
}
