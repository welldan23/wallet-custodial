import { useMemo } from 'react';

import type { SentTransfer } from '@/lib/sent-transfers';
import type { SwapRecord } from '@/lib/swap-records';

import { useSentTransfers } from './use-sent-transfers';
import { useSwaps } from './use-swaps';

export type ActivityItem = ({ kind: 'send' } & SentTransfer) | ({ kind: 'swap' } & SwapRecord);

/**
 * Semua aktivitas sesi ini (kirim + swap), terbaru di depan. Sumber data
 * halaman Riwayat; nanti digabung dengan riwayat dari indexer/backend.
 */
export function useActivity(): ActivityItem[] {
  const { transfers } = useSentTransfers();
  const { swaps } = useSwaps();
  return useMemo(
    () =>
      [
        ...transfers.map((item) => ({ kind: 'send' as const, ...item })),
        ...swaps.map((item) => ({ kind: 'swap' as const, ...item })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [transfers, swaps],
  );
}
