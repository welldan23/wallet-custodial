export type KnownAddress = {
  address: string;
  /** Nama kontak, atau label lain (mis. "Penerima sebelumnya"). */
  label: string;
};

export type LookalikeMatch = {
  known: KnownAddress;
  /** Jumlah karakter awal yang sama (tanpa `0x`). */
  prefix: number;
  /** Jumlah karakter akhir yang sama. */
  suffix: number;
};

export type RecipientRecognition =
  | { kind: 'unknown' }
  | { kind: 'exact'; known: KnownAddress }
  | { kind: 'lookalike'; match: LookalikeMatch };

const body = (address: string) => (address.startsWith('0x') ? address.slice(2) : address);
/** EVM tidak peka huruf besar-kecil; Solana (base58) peka. */
const normalize = (address: string) =>
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

/**
 * Kenali alamat tujuan terhadap alamat yang sudah dikenal. "Lookalike"
 * = awal & akhir sama (pola address poisoning) tapi alamatnya berbeda.
 * Batas: minimal 3 karakter di awal dan akhir, total ≥ 7 — peluang
 * kebetulan untuk alamat acak sekitar 1 banding ratusan juta.
 */
export function recognizeRecipient(recipient: string, known: KnownAddress[]): RecipientRecognition {
  const target = normalize(recipient);
  if (!target) return { kind: 'unknown' };

  let best: LookalikeMatch | null = null;
  for (const entry of known) {
    const candidate = normalize(entry.address);
    if (candidate === target) return { kind: 'exact', known: entry };
    const prefix = commonPrefix(candidate, target);
    const suffix = commonSuffix(candidate, target);
    if (prefix >= 3 && suffix >= 3 && prefix + suffix >= 7) {
      if (!best || prefix + suffix > best.prefix + best.suffix)
        best = { known: entry, prefix, suffix };
    }
  }
  return best ? { kind: 'lookalike', match: best } : { kind: 'unknown' };
}

/** Indeks karakter (di alamat lengkap) yang berbeda dari alamat pembanding. */
export function differingIndexes(address: string, other: string): Set<number> {
  const offset = address.startsWith('0x') ? 2 : 0;
  const a = normalize(address);
  const b = normalize(other);
  const diff = new Set<number>();
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) diff.add(i + offset);
  return diff;
}
