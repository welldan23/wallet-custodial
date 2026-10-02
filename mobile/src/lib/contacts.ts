import type { ChainType, Contact, Network } from '@/types/wallet';

/** Tipe alamat dari bentuknya: `0x…` = EVM, selain itu Solana (base58). */
export const chainTypeOfAddress = (address: string): ChainType =>
  address.startsWith('0x') ? 'evm' : 'solana';

/** Cocokkan kata kunci ke nama atau alamat (tanpa beda huruf besar-kecil). */
export function filterContacts(contacts: Contact[], query: string): Contact[] {
  const q = query.trim().toLowerCase();
  if (!q) return contacts;
  return contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(q) || contact.address.toLowerCase().includes(q),
  );
}

const byName = (a: Contact, b: Contact) =>
  a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });

/** Favorit dulu, lalu sisanya; masing-masing urut nama A–Z. */
export function groupContacts(contacts: Contact[]) {
  return {
    favorites: contacts.filter((contact) => contact.isFavorite).sort(byName),
    others: contacts.filter((contact) => !contact.isFavorite).sort(byName),
  };
}

/** Inisial untuk avatar, mis. "Deposit Tokocrypto" → "DT", "Budi (desainer)" → "BD", "Budi" → "BU". */
export function contactInitials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((part) => part.match(/[\p{L}\p{N}]/u)?.[0])
    .filter((letter): letter is string => Boolean(letter));
  if (letters.length === 0) return '?';
  if (letters.length === 1) {
    return (name.match(/[\p{L}\p{N}]/gu) ?? []).slice(0, 2).join('').toUpperCase();
  }
  return (letters[0]! + letters[1]!).toUpperCase();
}

/** Indeks warna avatar yang stabil untuk satu nama. */
export function avatarColorIndex(name: string, count: number): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % count;
}

/** Nama jaringan kontak; `null` = semua jaringan bertipe sama. */
export function contactNetwork(contact: Contact, networks: Network[]): Network | null {
  return contact.networkId
    ? (networks.find((network) => network.id === contact.networkId) ?? null)
    : null;
}

/** Kontak dengan alamat persis sama (EVM tanpa beda huruf besar-kecil). */
export function findContactByAddress(contacts: Contact[], address: string): Contact | undefined {
  if (!address) return undefined;
  const evm = address.startsWith('0x');
  return contacts.find((contact) =>
    evm ? contact.address.toLowerCase() === address.toLowerCase() : contact.address === address,
  );
}

export type ContactNetworkStatus =
  | { kind: 'ok' }
  /** Kontak disimpan untuk jaringan lain bertipe sama, mis. deposit exchange di Ethereum. */
  | { kind: 'other_network'; usual: Network }
  /** Tipe alamat beda total (Solana vs EVM): tidak bisa dipakai sama sekali. */
  | { kind: 'wrong_chain' };

/** Cocokkan kontak dengan jaringan aset yang mau dikirim. */
export function contactNetworkStatus(
  contact: Contact,
  network: Network,
  networks: Network[],
): ContactNetworkStatus {
  const usual = contact.networkId
    ? networks.find((item) => item.id === contact.networkId)
    : undefined;
  const chainType = usual?.chainType ?? chainTypeOfAddress(contact.address);
  if (chainType !== network.chainType) return { kind: 'wrong_chain' };
  if (usual && usual.id !== network.id) return { kind: 'other_network', usual };
  return { kind: 'ok' };
}
