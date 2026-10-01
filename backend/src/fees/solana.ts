import { address, createSolanaRpc, getAddressEncoder, getProgramDerivedAddress } from '@solana/kit';

import { SPL_TOKEN_PROGRAM_ADDRESS } from '../chains/solana.js';

import type { FeeEstimate, FeeEstimator, FeeRequest } from './types.js';

/** Biaya dasar per tanda tangan (lamport); transfer biasa = 1 tanda tangan. */
export const BASE_FEE_PER_SIGNATURE = 5_000n;
/** Batas compute unit yang dipasang wallet untuk transfer (dengan pembuatan akun token). */
export const COMPUTE_UNITS = { native: 1_000n, spl: 40_000n };
/** Ukuran akun token SPL (byte) — dasar sewa minimum. */
export const TOKEN_ACCOUNT_SIZE = 165n;

const ASSOCIATED_TOKEN_PROGRAM_ADDRESS = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

export type SolanaFeeRpc = {
  /** Priority fee terbaru (micro-lamport per compute unit) untuk transaksi yang menyentuh `accounts`. */
  recentPriorityFees(accounts: string[]): Promise<bigint[]>;
  accountExists(account: string): Promise<boolean>;
  rentExemptMinimum(size: bigint): Promise<bigint>;
};

/** Alamat akun token (ATA) milik `owner` untuk `mint`. */
export async function associatedTokenAddress(owner: string, mint: string): Promise<string> {
  const encoder = getAddressEncoder();
  const [pda] = await getProgramDerivedAddress({
    programAddress: address(ASSOCIATED_TOKEN_PROGRAM_ADDRESS),
    seeds: [
      encoder.encode(address(owner)),
      encoder.encode(address(SPL_TOKEN_PROGRAM_ADDRESS)),
      encoder.encode(address(mint)),
    ],
  });
  return pda;
}

/** Median (dibulatkan ke atas) dari daftar angka; 0 kalau kosong. */
export function medianCeil(values: bigint[]): bigint {
  if (values.length === 0) return 0n;
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  const sum = sorted[mid - 1]! + sorted[mid]!;
  return (sum + 1n) / 2n;
}

/**
 * Estimasi biaya kirim di Solana: biaya dasar + priority fee (median
 * priority fee bukan nol terbaru di akun mint × compute unit), plus sewa akun token kalau penerima SPL belum
 * punya akun untuk token itu (dibayar pengirim, sekitar 0,002 SOL).
 */
export function solanaFeeEstimatorFromRpc(rpc: SolanaFeeRpc): FeeEstimator {
  return {
    async estimate({ token, to }: FeeRequest): Promise<FeeEstimate> {
      const isNative = token.contractAddress === null;
      const units = isNative ? COMPUTE_UNITS.native : COMPUTE_UNITS.spl;
      // Banyak slot tanpa priority fee sama sekali; median dari yang bukan nol
      // = harga yang dibayar transaksi lain yang memang ingin cepat masuk.
      const recent = await rpc.recentPriorityFees(isNative ? [] : [token.contractAddress!]);
      const microLamportsPerUnit = medianCeil(recent.filter((fee) => fee > 0n));
      const priority = (microLamportsPerUnit * units + 999_999n) / 1_000_000n;

      const parts: FeeEstimate['parts'] = [
        { kind: 'execution', raw: BASE_FEE_PER_SIGNATURE },
        { kind: 'priority', raw: priority },
      ];

      let createsRecipientAccount: boolean | undefined;
      if (!isNative && to) {
        const ata = await associatedTokenAddress(to, token.contractAddress!);
        createsRecipientAccount = !(await rpc.accountExists(ata));
        if (createsRecipientAccount) {
          parts.push({
            kind: 'token_account_rent',
            raw: await rpc.rentExemptMinimum(TOKEN_ACCOUNT_SIZE),
          });
        }
      }

      return {
        totalRaw: parts.reduce((sum, part) => sum + part.raw, 0n),
        parts,
        method: isNative || to ? 'simulated' : 'approximate',
        createsRecipientAccount,
      };
    },
  };
}

export function createSolanaFeeEstimator(rpcUrl: string): FeeEstimator {
  const rpc = createSolanaRpc(rpcUrl);
  return solanaFeeEstimatorFromRpc({
    async recentPriorityFees(accounts) {
      const fees = await rpc
        .getRecentPrioritizationFees(accounts.map((item) => address(item)))
        .send();
      return fees.map((fee) => BigInt(fee.prioritizationFee));
    },
    async accountExists(account) {
      const info = await rpc.getAccountInfo(address(account), { encoding: 'base64' }).send();
      return info.value !== null;
    },
    async rentExemptMinimum(size) {
      return BigInt(await rpc.getMinimumBalanceForRentExemption(size).send());
    },
  });
}
