import { isAddress as isSolanaAddress } from '@solana/kit';
import { getAddress, isAddress as isEvmAddress } from 'viem';

import type { Network, WalletAccounts } from '@/types/wallet';

export type InvalidReason =
  /** 0x… tapi panjang/karakternya salah. */
  | 'evm_format'
  /** Huruf besar-kecil tidak cocok dengan checksum → kemungkinan salah ketik. */
  | 'evm_checksum'
  /** Alamat Solana dimasukkan untuk jaringan EVM. */
  | 'solana_on_evm'
  /** Alamat EVM dimasukkan untuk jaringan Solana. */
  | 'evm_on_solana'
  | 'solana_format'
  | 'tron'
  | 'bitcoin'
  | 'unknown';

export type RecipientCheck =
  | { status: 'empty' }
  | { status: 'invalid'; reason: InvalidReason }
  | {
      status: 'valid';
      /** Alamat siap pakai (EVM dalam format checksum). */
      address: string;
      /** Peringatan yang tidak menghalangi, mis. kirim ke alamat sendiri. */
      warning?: 'own_address';
    };

const EVM_LIKE = /^0x[0-9a-fA-F]{40}$/;
const TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const BITCOIN = /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/;

/** Buang spasi/baris baru yang sering ikut saat menempel alamat. */
export function cleanAddressInput(input: string): string {
  return input.replace(/\s+/g, '');
}

/**
 * Periksa alamat tujuan untuk jaringan yang dipilih. Format jaringan lain
 * (Solana di EVM, Tron, Bitcoin) dikenali supaya pesan errornya jelas.
 */
export function validateRecipient(
  input: string,
  network: Network,
  ownAccounts?: WalletAccounts,
): RecipientCheck {
  const value = cleanAddressInput(input);
  if (!value) return { status: 'empty' };

  if (network.chainType === 'evm') {
    if (EVM_LIKE.test(value)) {
      if (!isEvmAddress(value, { strict: true }))
        return { status: 'invalid', reason: 'evm_checksum' };
      const address = getAddress(value);
      const own = ownAccounts && getAddress(ownAccounts.evm) === address;
      return own
        ? { status: 'valid', address, warning: 'own_address' }
        : { status: 'valid', address };
    }
    if (TRON.test(value)) return { status: 'invalid', reason: 'tron' };
    if (isSolanaAddress(value)) return { status: 'invalid', reason: 'solana_on_evm' };
    if (BITCOIN.test(value)) return { status: 'invalid', reason: 'bitcoin' };
    return { status: 'invalid', reason: value.startsWith('0x') ? 'evm_format' : 'unknown' };
  }

  if (isSolanaAddress(value)) {
    const own = ownAccounts?.solana === value;
    return own
      ? { status: 'valid', address: value, warning: 'own_address' }
      : { status: 'valid', address: value };
  }
  if (EVM_LIKE.test(value)) return { status: 'invalid', reason: 'evm_on_solana' };
  if (TRON.test(value)) return { status: 'invalid', reason: 'tron' };
  if (BITCOIN.test(value)) return { status: 'invalid', reason: 'bitcoin' };
  return { status: 'invalid', reason: 'solana_format' };
}
