import { useMemo } from 'react';

import { buildGasSummary } from '@/lib/gas';
import { MOCK_NETWORKS, MOCK_PRICES, MOCK_TOKENS, MOCK_TRANSFER_FEES_USD } from '@/mocks/wallet';

import { useWalletBalances } from './use-wallet-balances';

/**
 * Ringkasan saldo gas semua jaringan. Sementara dari data tiruan; nanti
 * saldo dari RPC dan perkiraan biaya dari backend.
 */
export function useGasSummary() {
  const balances = useWalletBalances();
  return useMemo(
    () =>
      buildGasSummary({
        networks: MOCK_NETWORKS,
        tokens: MOCK_TOKENS,
        prices: MOCK_PRICES,
        balances,
        transferFeesUsd: MOCK_TRANSFER_FEES_USD,
      }),
    [balances],
  );
}
