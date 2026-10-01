import type { Token } from '../types.js';

/** Saldo mentah (satuan terkecil, mis. wei/lamport) satu token. */
export type RawBalance = {
  tokenId: string;
  raw: bigint;
};

/** Pembaca saldo satu jaringan. Hanya butuh alamat publik — tidak pernah kunci. */
export interface BalanceReader {
  read(owner: string, tokens: Token[]): Promise<RawBalance[]>;
}
