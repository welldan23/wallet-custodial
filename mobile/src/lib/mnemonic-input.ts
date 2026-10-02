import { MNEMONIC_WORDLIST } from './mnemonic';

export const MNEMONIC_LENGTH = 12;
const WORDS = new Set(MNEMONIC_WORDLIST);

/**
 * Pecah teks tempelan jadi kata: huruf kecil, buang nomor urut ("1.", "2)"),
 * koma, dan spasi/baris baru berlebih.
 */
export function splitMnemonicText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\d+[.)]?/g, ' ')
    .split(/[\s,;]+/)
    .filter(Boolean);
}

export type WordStatus = 'empty' | 'valid' | 'typing' | 'invalid';

/** `typing` = belum lengkap tapi masih awalan kata yang ada. */
export function wordStatus(word: string): WordStatus {
  const value = word.trim().toLowerCase();
  if (!value) return 'empty';
  if (WORDS.has(value)) return 'valid';
  return MNEMONIC_WORDLIST.some((item) => item.startsWith(value)) ? 'typing' : 'invalid';
}

/** Saran kata yang diawali `prefix` (maks `limit`). */
export function suggestWords(prefix: string, limit = 4): string[] {
  const value = prefix.trim().toLowerCase();
  if (!value) return [];
  const matches: string[] = [];
  for (const word of MNEMONIC_WORDLIST) {
    if (word.startsWith(value)) matches.push(word);
    if (matches.length === limit) break;
  }
  return matches;
}

/** Isi kata mulai dari posisi `start` (untuk tempel banyak kata sekaligus). */
export function fillWords(current: string[], start: number, incoming: string[]): string[] {
  const next = [...current];
  incoming.slice(0, MNEMONIC_LENGTH - start).forEach((word, offset) => {
    next[start + offset] = word;
  });
  return next;
}
