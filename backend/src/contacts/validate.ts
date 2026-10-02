import { isAddress as isSolanaAddress } from '@solana/kit';
import { getAddress, isAddress as isEvmAddress } from 'viem';

import type { ChainType, Network } from '../types.js';
import type { NewContact } from './store.js';

/** Sama dengan batas di form aplikasi (`CONTACT_NAME_MAX`). */
export const CONTACT_NAME_MAX = 40;

/** Alasan alamat ditolak; namanya sama dengan `InvalidReason` di aplikasi. */
export type AddressReason =
  'evm_format' | 'evm_checksum' | 'solana_on_evm' | 'evm_on_solana' | 'solana_format';

export type ContactInputError =
  | { error: 'invalid_name'; reason: 'missing' | 'empty' | 'too_long' | 'invalid_characters' }
  | { error: 'invalid_address'; reason: AddressReason | 'missing' }
  | { error: 'unknown_network' }
  | { error: 'invalid_favorite' };

export type ParsedContact =
  { ok: true; contact: Required<NewContact> } | ({ ok: false } & ContactInputError);

const EVM_LIKE = /^0x[0-9a-fA-F]{40}$/;
// Karakter kontrol (baris baru, tab, dll.) tidak boleh ada di nama.
const CONTROL = /\p{Cc}/u;

type ParsedName =
  | { ok: true; name: string }
  | ({ ok: false } & Extract<ContactInputError, { error: 'invalid_name' }>);

/** Nama: dirapikan (spasi ganda jadi satu), wajib, maksimal 40 karakter. */
export function parseContactName(value: unknown): ParsedName {
  if (typeof value !== 'string') return { ok: false, error: 'invalid_name', reason: 'missing' };
  if (CONTROL.test(value.replace(/[\t\n\r]/g, ' ')))
    return { ok: false, error: 'invalid_name', reason: 'invalid_characters' };
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'invalid_name', reason: 'empty' };
  if ([...name].length > CONTACT_NAME_MAX)
    return { ok: false, error: 'invalid_name', reason: 'too_long' };
  return { ok: true, name };
}

/**
 * Periksa alamat untuk tipe jaringan tertentu. EVM dikembalikan dalam format
 * checksum; huruf besar-kecil campuran yang tidak cocok checksum ditolak
 * (tanda salah ketik).
 */
export function parseContactAddress(
  value: unknown,
  chainType: ChainType,
): { ok: true; address: string } | { ok: false; reason: AddressReason | 'missing' } {
  if (typeof value !== 'string') return { ok: false, reason: 'missing' };
  const address = value.replace(/\s+/g, '');
  if (!address) return { ok: false, reason: 'missing' };

  if (chainType === 'evm') {
    if (EVM_LIKE.test(address)) {
      if (!isEvmAddress(address, { strict: true })) return { ok: false, reason: 'evm_checksum' };
      return { ok: true, address: getAddress(address) };
    }
    return { ok: false, reason: isSolanaAddress(address) ? 'solana_on_evm' : 'evm_format' };
  }
  if (isSolanaAddress(address)) return { ok: true, address };
  return { ok: false, reason: EVM_LIKE.test(address) ? 'evm_on_solana' : 'solana_format' };
}

/**
 * Periksa body tambah/ubah kontak: `{ name, address, networkId?, isFavorite? }`.
 * `networkId` kosong/`null` = semua jaringan; tipe alamat lalu ditebak dari
 * bentuknya (`0x…` = EVM, selain itu Solana).
 */
export function parseContactInput(body: unknown, networks: Network[]): ParsedContact {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  const name = parseContactName(input.name);
  if (!name.ok) return name;

  let networkId: string | null = null;
  let chainType: ChainType;
  if (input.networkId !== undefined && input.networkId !== null && input.networkId !== '') {
    const network = networks.find((item) => item.id === input.networkId && item.isActive);
    if (!network) return { ok: false, error: 'unknown_network' };
    networkId = network.id;
    chainType = network.chainType;
  } else {
    const raw = typeof input.address === 'string' ? input.address.trim() : '';
    chainType = raw.startsWith('0x') ? 'evm' : 'solana';
  }

  const address = parseContactAddress(input.address, chainType);
  if (!address.ok) return { ok: false, error: 'invalid_address', reason: address.reason };

  if (input.isFavorite !== undefined && typeof input.isFavorite !== 'boolean') {
    return { ok: false, error: 'invalid_favorite' };
  }

  return {
    ok: true,
    contact: {
      name: name.name,
      address: address.address,
      chainType,
      networkId,
      isFavorite: input.isFavorite === true,
    },
  };
}
