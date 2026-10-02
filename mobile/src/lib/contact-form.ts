import {
  cleanAddressInput,
  validateRecipient,
  type RecipientCheck,
} from '@/lib/address-validation';
import type { ChainType, Contact, Network, NetworkId, WalletAccounts } from '@/types/wallet';

/** Batas panjang nama kontak (setelah spasi di ujung dibuang). */
export const CONTACT_NAME_MAX = 40;

/** Pilihan jaringan di form: semua jaringan EVM sekaligus, atau satu jaringan tertentu. */
export type ContactScope = 'all_evm' | NetworkId;

export type ContactFormInput = {
  name: string;
  address: string;
  scope: ContactScope;
  isFavorite: boolean;
};

export type NameCheck =
  | { status: 'empty' }
  | { status: 'too_long'; max: number }
  | { status: 'valid'; name: string };

export type ContactAddressCheck =
  | RecipientCheck
  /** Alamat yang sama sudah tersimpan untuk jaringan yang tumpang tindih. */
  | { status: 'duplicate'; existingName: string };

export type ContactFormCheck = {
  name: NameCheck;
  address: ContactAddressCheck;
  /** Kontak siap disimpan; `null` kalau masih ada yang salah. */
  contact: Omit<Contact, 'id'> | null;
};

/** `all_evm` disimpan sebagai `networkId: null` (berlaku di semua jaringan EVM). */
export const scopeNetworkId = (scope: ContactScope): NetworkId | null =>
  scope === 'all_evm' ? null : scope;

export function scopeChainType(scope: ContactScope, networks: Network[]): ChainType {
  if (scope === 'all_evm') return 'evm';
  return networks.find((network) => network.id === scope)?.chainType ?? 'evm';
}

const EVM_LIKE = /^0x[0-9a-fA-F]{40}$/;
const BASE58_LIKE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Tebak tipe alamat dari bentuknya, untuk memilih jaringan otomatis. */
export function guessChainType(input: string): ChainType | null {
  const value = cleanAddressInput(input);
  if (EVM_LIKE.test(value)) return 'evm';
  if (BASE58_LIKE.test(value)) return 'solana';
  return null;
}

export function checkContactName(input: string): NameCheck {
  const name = input.trim().replace(/\s+/g, ' ');
  if (!name) return { status: 'empty' };
  if (name.length > CONTACT_NAME_MAX) return { status: 'too_long', max: CONTACT_NAME_MAX };
  return { status: 'valid', name };
}

/** Jaringan yang dipakai untuk memeriksa alamat. `all_evm` → jaringan EVM pertama. */
function validationNetwork(scope: ContactScope, networks: Network[]): Network | undefined {
  if (scope === 'all_evm') return networks.find((network) => network.chainType === 'evm');
  return networks.find((network) => network.id === scope);
}

const sameAddress = (a: string, b: string, chainType: ChainType) =>
  chainType === 'evm' ? a.toLowerCase() === b.toLowerCase() : a === b;

/**
 * Kontak lain dengan alamat yang sama dan jaringan yang tumpang tindih
 * (sama persis, atau salah satunya "semua jaringan" bertipe sama).
 */
export function findDuplicateContact(
  address: string,
  networkId: NetworkId | null,
  chainType: ChainType,
  contacts: Contact[],
  networks: Network[],
): Contact | undefined {
  const chainOf = (contact: Contact): ChainType =>
    contact.networkId
      ? (networks.find((network) => network.id === contact.networkId)?.chainType ?? 'evm')
      : contact.address.startsWith('0x')
        ? 'evm'
        : 'solana';
  return contacts.find(
    (contact) =>
      chainOf(contact) === chainType &&
      sameAddress(contact.address, address, chainType) &&
      (networkId === null || contact.networkId === null || contact.networkId === networkId),
  );
}

/** Periksa seluruh form tambah kontak. */
export function checkContactForm(
  input: ContactFormInput,
  deps: { networks: Network[]; contacts: Contact[]; ownAccounts?: WalletAccounts },
): ContactFormCheck {
  const name = checkContactName(input.name);
  const network = validationNetwork(input.scope, deps.networks);
  const recipient: RecipientCheck = network
    ? validateRecipient(input.address, network, deps.ownAccounts)
    : { status: 'invalid', reason: 'unknown' };

  let address: ContactAddressCheck = recipient;
  const networkId = scopeNetworkId(input.scope);
  if (recipient.status === 'valid') {
    const duplicate = findDuplicateContact(
      recipient.address,
      networkId,
      scopeChainType(input.scope, deps.networks),
      deps.contacts,
      deps.networks,
    );
    if (duplicate) address = { status: 'duplicate', existingName: duplicate.name };
  }

  const contact =
    name.status === 'valid' && address.status === 'valid'
      ? { name: name.name, address: address.address, networkId, isFavorite: input.isFavorite }
      : null;
  return { name, address, contact };
}
