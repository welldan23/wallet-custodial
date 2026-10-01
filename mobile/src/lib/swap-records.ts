import type { NetworkId, TokenBalance } from '@/types/wallet';

import type { TransferStatus } from './sent-transfers';

/** Satu swap yang sudah disetujui pengguna. */
export type SwapRecord = {
  id: string;
  fromTokenId: string;
  fromSymbol: string;
  fromNetworkId: NetworkId;
  fromAmount: number;
  toTokenId: string;
  toSymbol: string;
  toNetworkId: NetworkId;
  /** Perkiraan saat konfirmasi; jumlah final bisa sedikit beda (≥ minimal diterima). */
  toAmount: number;
  minReceived: number;
  slippage: number;
  provider: string;
  crossChain: boolean;
  /** Biaya jaringan asal dalam koin gas. */
  feeNative: number;
  feeUsd: number;
  bridgeFeeUsd: number;
  amountUsd: number;
  txHash: string;
  status: TransferStatus;
  createdAt: string;
};

/**
 * Terapkan swap ke saldo: koin asal + gas langsung berkurang; koin tujuan
 * baru bertambah setelah swap `confirmed`. Saldo tidak pernah di bawah nol.
 * Dipakai selama saldo masih tiruan.
 */
export function applySwaps(
  balances: TokenBalance[],
  swaps: SwapRecord[],
  nativeTokenIdByNetwork: Partial<Record<NetworkId, string>>,
): TokenBalance[] {
  if (swaps.length === 0) return balances;

  const delta = new Map<string, number>();
  const add = (tokenId: string | undefined, amount: number) => {
    if (!tokenId || amount === 0) return;
    delta.set(tokenId, (delta.get(tokenId) ?? 0) + amount);
  };
  for (const swap of swaps) {
    add(swap.fromTokenId, -swap.fromAmount);
    add(nativeTokenIdByNetwork[swap.fromNetworkId], -swap.feeNative);
    if (swap.status === 'confirmed') add(swap.toTokenId, swap.toAmount);
  }

  const result = balances.map((balance) => {
    const change = delta.get(balance.tokenId);
    if (change === undefined) return balance;
    delta.delete(balance.tokenId);
    const next = balance.amount + change;
    return { ...balance, amount: next > 1e-12 ? next : 0 };
  });
  // Koin tujuan yang sebelumnya belum punya saldo sama sekali.
  for (const [tokenId, change] of delta) {
    if (change > 1e-12) result.push({ tokenId, amount: change });
  }
  return result;
}
