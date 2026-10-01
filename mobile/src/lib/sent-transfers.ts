import type { NetworkId, Token, TokenBalance } from '@/types/wallet';

export type TransferStatus = 'pending' | 'confirmed';

/** Satu kiriman yang sudah disetujui pengguna. */
export type SentTransfer = {
  id: string;
  tokenId: string;
  symbol: string;
  isStablecoin: boolean;
  networkId: NetworkId;
  amount: number;
  /** Biaya jaringan dalam koin gas (ETH/POL/SOL). */
  feeNative: number;
  feeUsd: number;
  amountUsd: number;
  to: string;
  /** Nama kontak kalau alamatnya dari Buku Alamat. */
  contact?: string;
  txHash: string;
  status: TransferStatus;
  createdAt: string;
};

/** Id token koin gas di satu jaringan, mis. `eth-arbitrum`. */
export const nativeTokenIdOf = (
  tokens: Token[],
  networkId: NetworkId,
  nativeSymbol: string,
): string | undefined =>
  tokens.find((token) => token.networkId === networkId && token.symbol === nativeSymbol)?.id;

/**
 * Kurangi saldo dengan kiriman yang sudah dibuat: jumlah dari token yang
 * dikirim, biaya dari koin gas jaringannya. Saldo tidak pernah di bawah nol.
 * Dipakai selama saldo masih tiruan; nanti saldo asli dibaca ulang dari RPC.
 */
export function applySentTransfers(
  balances: TokenBalance[],
  transfers: SentTransfer[],
  nativeTokenIdByNetwork: Partial<Record<NetworkId, string>>,
): TokenBalance[] {
  if (transfers.length === 0) return balances;

  const spent = new Map<string, number>();
  const add = (tokenId: string | undefined, amount: number) => {
    if (!tokenId || amount <= 0) return;
    spent.set(tokenId, (spent.get(tokenId) ?? 0) + amount);
  };
  for (const transfer of transfers) {
    add(transfer.tokenId, transfer.amount);
    add(nativeTokenIdByNetwork[transfer.networkId], transfer.feeNative);
  }

  return balances.map((balance) => {
    const used = spent.get(balance.tokenId);
    if (!used) return balance;
    // Pembulatan kecil supaya sisa 1e-15 dianggap nol.
    const left = balance.amount - used;
    return { ...balance, amount: left > 1e-12 ? left : 0 };
  });
}

const HEX = '0123456789abcdef';
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const randomFrom = (alphabet: string, length: number) =>
  Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');

/** Hash transaksi TIRUAN dengan bentuk yang mirip aslinya (khusus mode demo). */
export const mockTxHash = (chainType: 'evm' | 'solana') =>
  chainType === 'evm' ? `0x${randomFrom(HEX, 64)}` : randomFrom(BASE58, 88);

/** Tautan transaksi di block explorer jaringannya. */
export const explorerTxUrl = (explorerUrl: string, txHash: string) =>
  `${explorerUrl.replace(/\/$/, '')}/tx/${txHash}`;
