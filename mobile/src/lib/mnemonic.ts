import { entropyToMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

/** 128 bit entropi = 12 kata (BIP39). */
const ENTROPY_BYTES = 16;

/**
 * Bikin frasa pemulihan 12 kata (BIP39, daftar kata bahasa Inggris).
 * `randomBytes` WAJIB sumber acak kriptografis (expo-crypto di HP) — jangan
 * pernah `Math.random`.
 */
export function createMnemonic(randomBytes: (count: number) => Uint8Array): string[] {
  const entropy = randomBytes(ENTROPY_BYTES);
  if (entropy.length !== ENTROPY_BYTES) throw new Error('entropy_length');
  return entropyToMnemonic(entropy, wordlist).split(' ');
}

/** `true` kalau 12 kata ini frasa BIP39 yang sah (kata dikenal + checksum cocok). */
export const isValidMnemonic = (words: string[]) => validateMnemonic(words.join(' '), wordlist);

export { wordlist as MNEMONIC_WORDLIST };
