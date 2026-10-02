import { createHash, randomUUID } from 'node:crypto';

import type { Db } from '../db/database.js';
import type { ChainType } from '../types.js';

/** Token perangkat: acak, minimal 32 karakter (mis. UUID v4 atau 32 byte base64url). */
export const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export const hashDeviceToken = (token: string) => createHash('sha256').update(token).digest('hex');

export type Contact = {
  id: string;
  name: string;
  address: string;
  chainType: ChainType;
  /** `null` = semua jaringan bertipe sama. */
  networkId: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NewContact = Pick<Contact, 'name' | 'address' | 'chainType' | 'networkId'> & {
  isFavorite?: boolean;
};

type ContactRow = Omit<Contact, 'isFavorite'> & { isFavorite: number };

/** Batas kontak per perangkat, supaya satu token tidak bisa mengisi database tanpa henti. */
export const MAX_CONTACTS_PER_USER = 500;

/** Alamat yang sama dengan jaringan tumpang tindih sudah tersimpan. */
export class DuplicateContactError extends Error {
  constructor(readonly existing: Pick<Contact, 'id' | 'name'> | null) {
    super('contact_duplicate');
    this.name = 'DuplicateContactError';
  }
}

export class ContactLimitError extends Error {
  constructor() {
    super('contact_limit');
    this.name = 'ContactLimitError';
  }
}

/** Kunci pembanding alamat, sama dengan kolom `address_key`. */
export const contactAddressKey = (address: string, chainType: ChainType) =>
  chainType === 'evm' ? address.toLowerCase() : address;

const SELECT_CONTACT = `SELECT id, name, address, chain_type AS chainType, network_id AS networkId,
       is_favorite AS isFavorite, created_at AS createdAt, updated_at AS updatedAt
FROM contacts`;
const toContact = (row: ContactRow): Contact => ({ ...row, isFavorite: row.isFavorite === 1 });

/** Akses tabel `users` (pengguna anonim per perangkat) dan `contacts`. */
export class ContactStore {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Id pengguna untuk token perangkat; `null` kalau belum pernah terdaftar. */
  findUserId(deviceToken: string): string | null {
    const row = this.db
      .prepare('SELECT id FROM users WHERE device_id_hash = ?')
      .get(hashDeviceToken(deviceToken)) as { id: string } | undefined;
    return row?.id ?? null;
  }

  /** Id pengguna untuk token perangkat; dibuat kalau belum ada. */
  ensureUserId(deviceToken: string): string {
    const hash = hashDeviceToken(deviceToken);
    this.db
      .prepare(
        'INSERT INTO users (id, device_id_hash, created_at) VALUES (?, ?, ?) ON CONFLICT (device_id_hash) DO NOTHING',
      )
      .run(randomUUID(), hash, this.now().toISOString());
    return this.findUserId(deviceToken)!;
  }

  count(userId: string): number {
    return (
      this.db.prepare('SELECT COUNT(*) AS n FROM contacts WHERE user_id = ?').get(userId) as {
        n: number;
      }
    ).n;
  }

  get(userId: string, id: string): Contact | null {
    const row = this.db
      .prepare(`${SELECT_CONTACT} WHERE user_id = ? AND id = ?`)
      .get(userId, id) as ContactRow | undefined;
    return row ? toContact(row) : null;
  }

  /**
   * Kontak lain dengan alamat sama (EVM tanpa beda huruf besar-kecil) dan
   * jaringan tumpang tindih: sama persis, atau salah satunya "semua jaringan".
   */
  findOverlapping(
    userId: string,
    contact: Pick<NewContact, 'address' | 'chainType' | 'networkId'>,
    excludeId?: string,
  ): Contact | null {
    const row = this.db
      .prepare(
        `${SELECT_CONTACT}
         WHERE user_id = @userId AND address_key = @key AND id IS NOT @excludeId
           AND (network_id IS NULL OR @networkId IS NULL OR network_id = @networkId)
         ORDER BY created_at LIMIT 1`,
      )
      .get({
        userId,
        key: contactAddressKey(contact.address, contact.chainType),
        networkId: contact.networkId,
        excludeId: excludeId ?? null,
      }) as ContactRow | undefined;
    return row ? toContact(row) : null;
  }

  /**
   * Simpan kontak baru. Melempar `DuplicateContactError` kalau dobel dan
   * `ContactLimitError` kalau sudah mencapai batas.
   */
  add(userId: string, contact: NewContact): Contact {
    const id = randomUUID();
    const at = this.now().toISOString();
    this.db.transaction(() => {
      const duplicate = this.findOverlapping(userId, contact);
      if (duplicate) throw new DuplicateContactError({ id: duplicate.id, name: duplicate.name });
      if (this.count(userId) >= MAX_CONTACTS_PER_USER) throw new ContactLimitError();
      try {
        this.db
          .prepare(
            `INSERT INTO contacts (id, user_id, name, address, chain_type, network_id, is_favorite, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            userId,
            contact.name.trim(),
            contact.address,
            contact.chainType,
            contact.networkId,
            contact.isFavorite ? 1 : 0,
            at,
            at,
          );
      } catch (error) {
        // Penjaga terakhir di database (trigger/indeks unik).
        if (error instanceof Error && /contact_duplicate|UNIQUE/.test(error.message)) {
          throw new DuplicateContactError(null);
        }
        throw error;
      }
    })();
    return this.get(userId, id)!;
  }

  /**
   * Kontak milik pengguna: favorit dulu lalu urut nama. Kalau `usableOn`
   * diisi, hanya kontak yang alamatnya bisa dipakai di jaringan itu
   * (jaringannya sama, atau kontak "semua jaringan" dengan tipe sama).
   */
  list(userId: string, usableOn?: { networkId: string; chainType: ChainType }): Contact[] {
    const filter = usableOn
      ? 'AND chain_type = @chainType AND (network_id IS NULL OR network_id = @networkId)'
      : '';
    const rows = this.db
      .prepare(
        `${SELECT_CONTACT}
         WHERE user_id = @userId ${filter}
         ORDER BY is_favorite DESC, name COLLATE NOCASE, created_at`,
      )
      .all({ userId, ...usableOn }) as ContactRow[];
    return rows.map(toContact);
  }
}
