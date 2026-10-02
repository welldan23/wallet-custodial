import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { ContactStore } from '../src/contacts/store.js';
import { runMigrations } from '../src/db/database.js';
import { MIGRATIONS } from '../src/db/migrations.js';
import { seedCatalog } from '../src/db/seed.js';

import { seededDb, TEST_NOW } from './helpers.js';

const EVM = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const SOL = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const TOKEN = 'b3f1c0de-7a9e-4c11-9d2a-5e6f7a8b9c0d';

function fresh() {
  const db = seededDb();
  const store = new ContactStore(db, () => TEST_NOW);
  return { db, store, userId: store.ensureUserId(TOKEN) };
}

describe('tabel contacts (migrasi 8)', () => {
  it('kolom & indeks sesuai', () => {
    const { db } = fresh();
    const cols = db.prepare('PRAGMA table_xinfo(contacts)').all() as { name: string }[];
    expect(cols.map((col) => col.name)).toEqual([
      'id',
      'user_id',
      'name',
      'address',
      'chain_type',
      'address_key',
      'network_id',
      'is_favorite',
      'created_at',
      'updated_at',
    ]);
    const indexes = (db.prepare('PRAGMA index_list(contacts)').all() as { name: string }[]).map(
      (index) => index.name,
    );
    expect(indexes).toEqual(expect.arrayContaining(['contacts_unique', 'contacts_user_order']));
  });

  it('nama: wajib, tanpa spasi di ujung, maksimal 40 karakter', () => {
    const { store, userId } = fresh();
    const add = (name: string, address: string) =>
      store.add(userId, { name, address, chainType: 'solana', networkId: 'solana' });
    expect(() => add('   ', SOL)).toThrow(/CHECK/);
    expect(() => add('x'.repeat(41), SOL)).toThrow(/CHECK/);
    expect(add('x'.repeat(40), SOL).name).toHaveLength(40);
  });

  it.each([
    ['evm', '0x123', /CHECK/],
    ['evm', `0x${'g'.repeat(40)}`, /CHECK/],
    ['evm', SOL, /CHECK/],
    ['solana', EVM, /CHECK/],
    ['solana', '0OIl' + SOL.slice(4), /CHECK/],
  ] as const)('format alamat %s salah ditolak: %s', (chainType, address, error) => {
    const { store, userId } = fresh();
    expect(() => store.add(userId, { name: 'X', address, chainType, networkId: null })).toThrow(
      error,
    );
  });

  it('jaringan harus setipe dengan alamat (insert & update)', () => {
    const { db, store, userId } = fresh();
    expect(() =>
      store.add(userId, { name: 'X', address: EVM, chainType: 'evm', networkId: 'solana' }),
    ).toThrow(/contact_network_mismatch/);
    const ok = store.add(userId, { name: 'X', address: EVM, chainType: 'evm', networkId: 'base' });
    expect(() =>
      db.prepare("UPDATE contacts SET network_id = 'solana' WHERE id = ?").run(ok.id),
    ).toThrow(/contact_network_mismatch/);
  });

  it('dobel: alamat EVM beda huruf besar-kecil & jaringan tumpang tindih', () => {
    const { store, userId } = fresh();
    store.add(userId, { name: 'A', address: EVM, chainType: 'evm', networkId: 'arbitrum' });
    for (const networkId of [null, 'arbitrum']) {
      expect(() =>
        store.add(userId, { name: 'B', address: EVM.toLowerCase(), chainType: 'evm', networkId }),
      ).toThrow(/contact_duplicate/);
    }
    // Jaringan lain yang spesifik = boleh (mis. alamat deposit berbeda per jaringan).
    expect(
      store.add(userId, { name: 'C', address: EVM, chainType: 'evm', networkId: 'ethereum' }).name,
    ).toBe('C');
  });

  it('ubah kontak: tidak dianggap dobel dengan dirinya sendiri, tapi dobel dengan kontak lain', () => {
    const { db, store, userId } = fresh();
    const a = store.add(userId, { name: 'A', address: EVM, chainType: 'evm', networkId: null });
    const b = store.add(userId, { name: 'B', address: SOL, chainType: 'solana', networkId: null });
    expect(() =>
      db.prepare("UPDATE contacts SET network_id = 'base', name = 'A2' WHERE id = ?").run(a.id),
    ).not.toThrow();
    expect(() =>
      db
        .prepare("UPDATE contacts SET address = ?, chain_type = 'evm' WHERE id = ?")
        .run(EVM.toLowerCase(), b.id),
    ).toThrow(/contact_duplicate/);
  });

  it('pengguna lain boleh menyimpan alamat yang sama; hapus pengguna = kontaknya ikut terhapus', () => {
    const { db, store, userId } = fresh();
    const other = store.ensureUserId('Zx9_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    store.add(userId, { name: 'A', address: EVM, chainType: 'evm', networkId: null });
    store.add(other, { name: 'A', address: EVM, chainType: 'evm', networkId: null });
    db.prepare('DELETE FROM users WHERE id = ?').run(other);
    expect(db.prepare('SELECT COUNT(*) AS n FROM contacts').get()).toEqual({ n: 1 });
  });
});

describe('migrasi 8 dari data lama', () => {
  it('nama dipotong 40, baris tidak valid & dobel dibuang, sisanya utuh', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(
      db,
      MIGRATIONS.filter((migration) => migration.id < 8),
    );
    seedCatalog(db);
    db.prepare("INSERT INTO users (id, device_id_hash, created_at) VALUES ('u1', 'h1', 't')").run();
    const insert = db.prepare(
      `INSERT INTO contacts (id, user_id, name, address, chain_type, network_id, is_favorite, created_at, updated_at)
       VALUES (?, 'u1', ?, ?, ?, ?, ?, ?, ?)`,
    );
    insert.run(
      'c1',
      '  Nama yang panjang sekali melebihi empat puluh karakter  ',
      EVM,
      'evm',
      null,
      1,
      '2026-01-01',
      '2026-01-01',
    );
    insert.run(
      'c2',
      'Dobel huruf kecil',
      EVM.toLowerCase(),
      'evm',
      'arbitrum',
      0,
      '2026-01-02',
      '2026-01-02',
    );
    insert.run('c3', 'Budi', SOL, 'solana', 'solana', 0, '2026-01-03', '2026-01-03');
    insert.run('c4', 'Alamat rusak', '0x123', 'evm', null, 0, '2026-01-04', '2026-01-04');
    insert.run(
      'c5',
      'Salah jaringan',
      `0x${'2'.repeat(40)}`,
      'evm',
      'solana',
      0,
      '2026-01-05',
      '2026-01-05',
    );

    runMigrations(db);
    const rows = db
      .prepare('SELECT id, name, address_key AS key, is_favorite AS fav FROM contacts ORDER BY id')
      .all();
    expect(rows).toEqual([
      { id: 'c1', name: 'Nama yang panjang sekali melebihi empat', key: EVM.toLowerCase(), fav: 1 },
      { id: 'c3', name: 'Budi', key: SOL, fav: 0 },
    ]);
    // Pemicu aturan langsung aktif setelah migrasi.
    expect(() => insert.run('c6', 'Lagi', EVM, 'evm', 'base', 0, 't', 't')).toThrow(
      /contact_duplicate/,
    );
  });
});
