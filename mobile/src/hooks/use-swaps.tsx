import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';

import { mockTxHash } from '@/lib/sent-transfers';
import type { SwapRecord } from '@/lib/swap-records';
import type { ChainType } from '@/types/wallet';

/** Lama simulasi swap di mode demo: bridge lebih lama dari swap satu jaringan. */
const MOCK_CONFIRM_MS = { sameChain: 3000, crossChain: 6000 };

export type NewSwap = Omit<SwapRecord, 'id' | 'txHash' | 'status' | 'createdAt'>;

type Swaps = {
  swaps: SwapRecord[];
  /** Catat swap baru (status `pending`) lalu kembalikan datanya. */
  recordSwap: (input: NewSwap, chainType: ChainType) => SwapRecord;
};

const SwapsContext = createContext<Swaps | null>(null);

/**
 * Daftar swap di sesi ini, terbaru di depan. Sementara tiruan: hash acak dan
 * status jadi `confirmed` setelah beberapa detik. Nanti dari agregator + RPC.
 */
export function SwapsProvider({ children }: { children: ReactNode }) {
  const [swaps, setSwaps] = useState<SwapRecord[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const recordSwap = (input: NewSwap, chainType: ChainType) => {
    const swap: SwapRecord = {
      ...input,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      txHash: mockTxHash(chainType),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setSwaps((current) => [swap, ...current]);

    const timer = setTimeout(
      () => {
        timers.current.delete(timer);
        setSwaps((current) =>
          current.map((item) => (item.id === swap.id ? { ...item, status: 'confirmed' } : item)),
        );
      },
      input.crossChain ? MOCK_CONFIRM_MS.crossChain : MOCK_CONFIRM_MS.sameChain,
    );
    timers.current.add(timer);

    return swap;
  };

  return <SwapsContext value={{ swaps, recordSwap }}>{children}</SwapsContext>;
}

export function useSwaps() {
  const value = use(SwapsContext);
  if (!value) throw new Error('useSwaps harus dipakai di dalam <SwapsProvider>');
  return value;
}
