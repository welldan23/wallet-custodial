import { useMemo } from 'react';

import { applySentTransfers, nativeTokenIdOf } from '@/lib/sent-transfers';
import { getMockBalances, MOCK_NETWORKS, MOCK_TOKENS } from '@/mocks/wallet';
import type { NetworkId } from '@/types/wallet';

import { useSentTransfers } from './use-sent-transfers';

const NATIVE_TOKEN_IDS = Object.fromEntries(
  MOCK_NETWORKS.map((network) => [
    network.id,
    nativeTokenIdOf(MOCK_TOKENS, network.id, network.nativeSymbol),
  ]),
) as Partial<Record<NetworkId, string>>;

/**
 * Saldo per token setelah dikurangi kiriman di sesi ini. Sementara dari data
 * tiruan; nanti dibaca dari RPC (yang otomatis sudah memuat kiriman).
 */
export function useWalletBalances() {
  const { transfers } = useSentTransfers();
  return useMemo(
    () => applySentTransfers(getMockBalances(), transfers, NATIVE_TOKEN_IDS),
    [transfers],
  );
}
