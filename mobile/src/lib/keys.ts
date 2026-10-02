import { ed25519 } from '@noble/curves/ed25519';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha2';
import { base58 } from '@scure/base';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { bytesToHex } from 'viem';
import { privateKeyToAddress } from 'viem/accounts';

import type { WalletAccounts } from '@/types/wallet';

/** Jalur turunan standar (sama dengan MetaMask & Phantom). */
export const DERIVATION_PATHS = {
  /** BIP44 Ethereum, akun pertama — satu alamat untuk semua jaringan EVM. */
  evm: "m/44'/60'/0'/0/0",
  /** SLIP-0010 ed25519, akun pertama Solana. */
  solana: "m/44'/501'/0'/0'",
} as const;

const HARDENED = 0x80000000;
const encoder = new TextEncoder();

/** Turunan SLIP-0010 ed25519 (semua indeks wajib hardened). Mengembalikan kunci privat 32 byte. */
export function slip10Ed25519(seed: Uint8Array, path: string): Uint8Array {
  const segments = path.split('/');
  if (segments[0] !== 'm') throw new Error('invalid_path');
  let digest = hmac(sha512, encoder.encode('ed25519 seed'), seed);
  let key = digest.slice(0, 32);
  let chainCode = digest.slice(32);
  for (const segment of segments.slice(1)) {
    if (!segment.endsWith("'")) throw new Error('ed25519_requires_hardened');
    const index = Number(segment.slice(0, -1)) + HARDENED;
    const data = new Uint8Array(37);
    data.set(key, 1); // data[0] = 0x00
    new DataView(data.buffer).setUint32(33, index >>> 0, false);
    digest = hmac(sha512, chainCode, data);
    key = digest.slice(0, 32);
    chainCode = digest.slice(32);
  }
  return key;
}

/**
 * Turunkan alamat publik EVM + Solana dari 12 kata. Kunci privat hanya
 * dipakai sesaat di memori untuk menghitung alamat, lalu dibuang — fungsi
 * ini tidak pernah mengembalikan atau menyimpannya.
 */
export function deriveAddresses(words: string[]): WalletAccounts {
  const seed = mnemonicToSeedSync(words.join(' '));
  try {
    const evmKey = HDKey.fromMasterSeed(seed).derive(DERIVATION_PATHS.evm).privateKey;
    if (!evmKey) throw new Error('evm_derivation_failed');
    const evm = privateKeyToAddress(bytesToHex(evmKey));
    evmKey.fill(0);

    const solanaKey = slip10Ed25519(seed, DERIVATION_PATHS.solana);
    const solana = base58.encode(ed25519.getPublicKey(solanaKey));
    solanaKey.fill(0);

    return { evm, solana };
  } finally {
    seed.fill(0);
  }
}
