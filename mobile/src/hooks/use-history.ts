import { useMemo } from 'react';

import { activityToHistory, type HistoryItem } from '@/lib/history';
import { getMockHistory } from '@/mocks/history';

import { useActivity } from './use-activity';

/**
 * Riwayat transaksi: aktivitas sesi ini + riwayat tiruan, terbaru dulu.
 * Nanti riwayat lama datang dari indexer/backend (tabel `transactions`).
 */
export function useHistory(): HistoryItem[] {
  const activity = useActivity();
  return useMemo(
    () =>
      [...activity.map(activityToHistory), ...getMockHistory()].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    [activity],
  );
}
