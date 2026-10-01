/** Isi kiriman yang dibaca dari transaksi bertanda tangan (bukan dari klaim aplikasi). */
export type DecodedTransfer = {
  txHash: string;
  /** Alamat pengirim (penanda tangan). */
  from: string;
  /** Alamat wallet penerima. */
  counterparty: string;
  tokenId: string;
  amountRaw: bigint;
};

export type DecodeErrorCode =
  | 'invalid_encoding'
  | 'unsigned'
  | 'wrong_chain'
  | 'unsupported_transaction'
  | 'unsupported_token'
  | 'invalid_amount';

/** Transaksi ditolak sebelum dikirim ke jaringan (format/isi tidak didukung). */
export class TransactionDecodeError extends Error {
  constructor(readonly code: DecodeErrorCode) {
    super(code);
    this.name = 'TransactionDecodeError';
  }
}

export type BroadcastErrorCode =
  'insufficient_funds' | 'nonce_too_low' | 'fee_too_low' | 'blockhash_expired' | 'rejected';

/** Jaringan menolak transaksi (mis. saldo kurang). Beda dengan RPC yang tidak bisa dihubungi. */
export class BroadcastRejectedError extends Error {
  constructor(readonly code: BroadcastErrorCode) {
    super(code);
    this.name = 'BroadcastRejectedError';
  }
}

/** Pengirim transaksi bertanda tangan ke satu jaringan. Mengembalikan hash/signature. */
export interface TransactionBroadcaster {
  send(signedTransaction: string): Promise<string>;
}
