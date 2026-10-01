import { MOCK_PRICES, MOCK_TRANSFER_FEES_USD } from '@/mocks/wallet';
import type { Network } from '@/types/wallet';

import { useGasSummary } from './use-gas-summary';

/**
 * Perkiraan biaya kirim + saldo koin gas di satu jaringan. Sementara dari
 * data tiruan; nanti estimasi gas dari RPC/backend.
 */
export function useNetworkFee(network: Network | null) {
  const gas = useGasSummary();
  const priceOf = (symbol: string) =>
    MOCK_PRICES.find((price) => price.symbol === symbol)?.usdPrice ?? 0;

  if (!network) return null;
  const chain = gas.chains.find((item) => item.network.id === network.id);
  return {
    feeUsd: MOCK_TRANSFER_FEES_USD[network.id],
    nativeSymbol: network.nativeSymbol,
    nativeUsdPrice: priceOf(network.nativeSymbol),
    nativeBalance: chain?.amount ?? 0,
    priceOf,
  };
}
