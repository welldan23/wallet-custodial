import { isAddress as isSolanaAddress } from '@solana/kit';
import { getAddress, isAddress as isEvmAddress } from 'viem';

import type { Catalog } from '../catalog/repository.js';
import type { ChainType } from '../types.js';
import type { NewContact } from './store.js';

/** Sama dengan batas di form aplikasi (`CONTACT_NAME_MAX`). */
export const CONTACT_NAME_MAX = 40;

/**
 * Alasan alamat ditolak. Format (sampai `unknown`) namanya sama dengan
 * `InvalidReason` di aplikasi; tiga terakhir khusus Buku Alamat.
 */
export type AddressReason =
  | 'evm_format'
  | 'evm_checksum'
  | 'solana_on_evm'
  | 'evm_on_solana'
  | 'solana_format'
  | 'tron'
  | 'bitcoin'
  | 'unknown'
  /** Alamat nol / 0x…dEaD: aset yang dikirim ke sini hangus. */
  | 'burn_address'
  /** Alamat program bawaan Solana (System, Token), bukan wallet. */
  | 'program_address'
  /** Alamat kontrak/mint token itu sendiri, bukan wallet penerima. */
  | 'token_contract';

export type ContactInputError =
  | { error: 'invalid_name'; reason: 'missing' | 'empty' | 'too_long' | 'invalid_characters' }
  | { error: 'invalid_address'; reason: AddressReason | 'missing'; tokenSymbol?: string }
  | { error: 'unknown_network' }
  | { error: 'invalid_favorite' };

export type ParsedContact =
  { ok: true; contact: Required<NewContact> } | ({ ok: false } & ContactInputError);

const EVM_LIKE = /^0x[0-9a-fA-F]{40}$/;
const TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const BITCOIN = /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/;

/** Alamat EVM yang dipakai untuk membakar aset (huruf kecil). */
const EVM_BURN = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
]);
/** Program bawaan Solana: System, SPL Token, Token-2022. */
const SOLANA_PROGRAMS = new Set([
  '11111111111111111111111111111111',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
]);
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

/** Format alamat jaringan yang belum didukung, untuk pesan yang lebih jelas. */
function otherFormat(address: string): 'tron' | 'bitcoin' | null {
  if (TRON.test(address)) return 'tron';
  if (BITCOIN.test(address)) return 'bitcoin';
  return null;
}

/**
 * Periksa format alamat untuk tipe jaringan tertentu. EVM dikembalikan dalam
 * format checksum; huruf besar-kecil campuran yang tidak cocok checksum
 * ditolak (tanda salah ketik). Alamat Solana dicek lebih dulu karena format
 * Tron/Bitcoin lama juga base58.
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
      if (EVM_BURN.has(address.toLowerCase())) return { ok: false, reason: 'burn_address' };
      return { ok: true, address: getAddress(address) };
    }
    if (isSolanaAddress(address)) return { ok: false, reason: 'solana_on_evm' };
    const other = otherFormat(address);
    if (other) return { ok: false, reason: other };
    return { ok: false, reason: address.startsWith('0x') ? 'evm_format' : 'unknown' };
  }

  if (isSolanaAddress(address)) {
    if (SOLANA_PROGRAMS.has(address)) return { ok: false, reason: 'program_address' };
    return { ok: true, address };
  }
  if (EVM_LIKE.test(address)) return { ok: false, reason: 'evm_on_solana' };
  return { ok: false, reason: otherFormat(address) ?? 'solana_format' };
}

/** Token di katalog yang alamat kontrak/mint-nya sama (jaringan bertipe sama). */
export function findTokenContract(
  address: string,
  chainType: ChainType,
  catalog: Pick<Catalog, 'networks' | 'tokens'>,
) {
  const key = chainType === 'evm' ? address.toLowerCase() : address;
  return catalog.tokens.find((token) => {
    if (!token.contractAddress) return false;
    const network = catalog.networks.find((item) => item.id === token.networkId);
    if (network?.chainType !== chainType) return false;
    const contract =
      chainType === 'evm' ? token.contractAddress.toLowerCase() : token.contractAddress;
    return contract === key;
  });
}

/**
 * Periksa body tambah/ubah kontak: `{ name, address, networkId?, isFavorite? }`.
 * `networkId` kosong/`null` = semua jaringan; tipe alamat lalu ditebak dari
 * bentuknya (`0x…` = EVM, selain itu Solana).
 */
export function parseContactInput(
  body: unknown,
  catalog: Pick<Catalog, 'networks' | 'tokens'>,
): ParsedContact {
  const { networks } = catalog;
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
  const token = findTokenContract(address.address, chainType, catalog);
  if (token) {
    return {
      ok: false,
      error: 'invalid_address',
      reason: 'token_contract',
      tokenSymbol: token.symbol,
    };
  }

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
