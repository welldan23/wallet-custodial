import type { Token } from '../types.js';

/**
 * - `simulated`: disimulasikan dengan jumlah & alamat asli (paling akurat)
 * - `approximate`: disimulasikan dengan jumlah 0 lalu diberi cadangan
 * - `default`: simulasi gagal, pakai angka gas umum untuk jenis transfer ini
 */
export type FeeMethod = 'simulated' | 'approximate' | 'default';

export type FeeRequest = {
  token: Token;
  /** Alamat pengirim (opsional). Dengan alamat asli, simulasi lebih akurat. */
  from?: string;
  /** Alamat penerima (opsional). Di Solana dipakai untuk cek akun token penerima. */
  to?: string;
  /** Jumlah dalam satuan terkecil (opsional). */
  amountRaw?: bigint;
};

export type FeeExtraKind = 'l1_data' | 'priority' | 'token_account_rent';

/** Komponen biaya; semua dalam satuan terkecil koin gas (wei/lamport). */
export type FeeEstimate = {
  /** Total biaya yang perlu disiapkan, termasuk semua `parts`. */
  totalRaw: bigint;
  parts: { kind: 'execution' | FeeExtraKind; raw: bigint }[];
  method: FeeMethod;
  /** EVM: perkiraan unit gas yang dipakai. */
  gasLimit?: bigint;
  /** EVM: harga gas maksimal per unit (wei). */
  maxFeePerGas?: bigint;
  /** Solana: penerima belum punya akun token → pengirim bayar sewa pembuatan akun. */
  createsRecipientAccount?: boolean;
};

/** Penghitung biaya kirim untuk satu jaringan. */
export interface FeeEstimator {
  estimate(request: FeeRequest): Promise<FeeEstimate>;
}
