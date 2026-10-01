import { useMemo } from 'react';

import { buildGasSummary } from '@/lib/gas';
import {
  getMockBalances,
  MOCK_NETWORKS,
  MOCK_PRICES,
  MOCK_TOKENS,
  MOCK_TRANSFER_FEES_USD,
} from '@/mocks/wallet';

/**
 * Ringkasan saldo gas semua jaringan. Sementara dari data tiruan; nanti
 * saldo dari RPC dan perkiraan biaya dari backend.
 */
export function useGasSummary() {
  return useMemo(
    () =>
      buildGasSummary({
        networks: MOCK_NETWORKS,
        tokens: MOCK_TOKENS,
        prices: MOCK_PRICES,
        balances: getMockBalances(),
        transferFeesUsd: MOCK_TRANSFER_FEES_USD,
      }),
    [],
  );
}
