import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';

import { mockTxHash, type SentTransfer } from '@/lib/sent-transfers';
import type { ChainType } from '@/types/wallet';

/** Lama simulasi menunggu konfirmasi jaringan di mode demo. */
const MOCK_CONFIRM_MS = 3000;

export type NewTransfer = Omit<SentTransfer, 'id' | 'txHash' | 'status' | 'createdAt'>;

type SentTransfers = {
  transfers: SentTransfer[];
  /** Catat kiriman baru (status `pending`) lalu kembalikan datanya. */
  recordTransfer: (input: NewTransfer, chainType: ChainType) => SentTransfer;
};

const SentTransfersContext = createContext<SentTransfers | null>(null);

/**
 * Daftar kiriman di sesi ini, terbaru di depan. Sementara semuanya tiruan:
 * hash dibuat acak dan status jadi `confirmed` setelah beberapa detik.
 * Nanti diganti hasil broadcast + pantauan status dari RPC.
 */
export function SentTransfersProvider({ children }: { children: ReactNode }) {
  const [transfers, setTransfers] = useState<SentTransfer[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const recordTransfer = (input: NewTransfer, chainType: ChainType) => {
    const transfer: SentTransfer = {
      ...input,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      txHash: mockTxHash(chainType),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setTransfers((current) => [transfer, ...current]);

    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setTransfers((current) =>
        current.map((item) => (item.id === transfer.id ? { ...item, status: 'confirmed' } : item)),
      );
    }, MOCK_CONFIRM_MS);
    timers.current.add(timer);

    return transfer;
  };

  return (
    <SentTransfersContext value={{ transfers, recordTransfer }}>{children}</SentTransfersContext>
  );
}

export function useSentTransfers() {
  const value = use(SentTransfersContext);
  if (!value) {
    throw new Error('useSentTransfers harus dipakai di dalam <SentTransfersProvider>');
  }
  return value;
}
