/**
 * Deteksi alamat mirip (address poisoning). Aturannya sama dengan aplikasi
 * mobile (`mobile/src/lib/lookalike.ts`): awal & akhir sama — minimal 3
 * karakter masing-masing dan total ≥ 7 — tapi alamatnya berbeda. Peluang
 * kebetulan untuk alamat acak sekitar 1 banding ratusan juta.
 */
export const MIN_SIDE = 3;
export const MIN_TOTAL = 7;

const body = (address: string) => (address.startsWith('0x') ? address.slice(2) : address);
/** EVM tidak peka huruf besar-kecil; Solana (base58) peka. */
export const normalizeAddress = (address: string) =>
  address.startsWith('0x') ? body(address).toLowerCase() : address;

function commonPrefix(a: string, b: string) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

function commonSuffix(a: string, b: string) {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i += 1;
  return i;
}

export type AddressCheck<T extends { address: string }> =
  | { result: 'new' }
  | { result: 'known'; match: T }
  | { result: 'lookalike'; match: T; prefix: number; suffix: number };

/** Bandingkan alamat tujuan dengan alamat yang sudah dikenal (cocok persis menang). */
export function checkAddress<T extends { address: string }>(
  recipient: string,
  known: T[],
): AddressCheck<T> {
  const target = normalizeAddress(recipient);
  let best: { match: T; prefix: number; suffix: number } | null = null;
  for (const entry of known) {
    const candidate = normalizeAddress(entry.address);
    if (candidate === target) return { result: 'known', match: entry };
    const prefix = commonPrefix(candidate, target);
    const suffix = commonSuffix(candidate, target);
    if (prefix >= MIN_SIDE && suffix >= MIN_SIDE && prefix + suffix >= MIN_TOTAL) {
      if (!best || prefix + suffix > best.prefix + best.suffix)
        best = { match: entry, prefix, suffix };
    }
  }
  return best ? { result: 'lookalike', ...best } : { result: 'new' };
}
