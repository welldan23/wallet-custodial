import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { ContactStore, hashDeviceToken } from '../src/contacts/store.js';
import { deviceTokenFrom } from '../src/routes/contacts.js';

import { makeDeps, seededDb, TEST_NOW } from './helpers.js';

const TOKEN = 'b3f1c0de-7a9e-4c11-9d2a-5e6f7a8b9c0d';
const OTHER_TOKEN = 'Zx9_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const EVM = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const SOL = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

function contactsApp() {
  const db = seededDb();
  const store = new ContactStore(db, () => TEST_NOW);
  const app = createApp({
    ...makeDeps(db, {}),
    priceStaleAfterMs: 15 * 60_000,
    logRequests: false,
    contactStore: store,
  });
  const get = async (query = '', token: string | null = TOKEN) => {
    const res = await app.request(`/v1/contacts${query}`, {
      headers: token ? { Authorization: `Device ${token}` } : {},
    });
    return { res, body: (await res.json()) as Record<string, any> };
  };
  return { app, db, store, get };
}

function seedContacts(store: ContactStore) {
  const userId = store.ensureUserId(TOKEN);
  store.add(userId, { name: 'Zainal', address: EVM, chainType: 'evm', networkId: null });
  store.add(userId, {
    name: 'Deposit Tokocrypto',
    address: EVM,
    chainType: 'evm',
    networkId: 'arbitrum',
    isFavorite: true,
  });
  store.add(userId, { name: 'budi', address: SOL, chainType: 'solana', networkId: 'solana' });
  store.add(userId, {
    name: 'Indodax',
    address: '0x2222222222222222222222222222222222222222',
    chainType: 'evm',
    networkId: 'ethereum',
  });
  return userId;
}

describe('token perangkat', () => {
  it.each([
    [`Device ${TOKEN}`, TOKEN],
    [`device ${OTHER_TOKEN}`, OTHER_TOKEN],
    ['Device pendek', null],
    [`Bearer ${TOKEN}`, null],
    [undefined, null],
    [`Device ${TOKEN} extra`, null],
  ])('%s', (header, expected) => {
    expect(deviceTokenFrom(header)).toBe(expected);
  });

  it('yang disimpan hanya hash token, bukan tokennya', () => {
    const { db, store } = contactsApp();
    store.ensureUserId(TOKEN);
    store.ensureUserId(TOKEN);
    const rows = db.prepare('SELECT device_id_hash AS hash FROM users').all();
    expect(rows).toEqual([{ hash: hashDeviceToken(TOKEN) }]);
    expect(JSON.stringify(rows)).not.toContain(TOKEN);
  });
});

describe('GET /v1/contacts', () => {
  it('daftar kontak perangkat ini: favorit dulu, lalu nama (tanpa beda huruf besar-kecil)', async () => {
    const { store, get } = contactsApp();
    seedContacts(store);
    const { res, body } = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body.contacts.map((contact: { name: string }) => contact.name)).toEqual([
      'Deposit Tokocrypto',
      'budi',
      'Indodax',
      'Zainal',
    ]);
    expect(body.contacts[0]).toEqual({
      id: expect.any(String),
      name: 'Deposit Tokocrypto',
      address: EVM,
      chainType: 'evm',
      networkId: 'arbitrum',
      isFavorite: true,
      createdAt: TEST_NOW.toISOString(),
      updatedAt: TEST_NOW.toISOString(),
    });
  });

  it('filter jaringan: kontak jaringan itu + kontak "semua jaringan" bertipe sama', async () => {
    const { store, get } = contactsApp();
    seedContacts(store);
    const names = async (network: string) =>
      (await get(`?network=${network}`)).body.contacts.map(
        (contact: { name: string }) => contact.name,
      );
    expect(await names('arbitrum')).toEqual(['Deposit Tokocrypto', 'Zainal']);
    expect(await names('ethereum')).toEqual(['Indodax', 'Zainal']);
    expect(await names('solana')).toEqual(['budi']);
  });

  it('perangkat lain tidak melihat kontak ini; perangkat baru dapat daftar kosong tanpa dibuatkan akun', async () => {
    const { db, store, get } = contactsApp();
    seedContacts(store);
    const { body } = await get('', OTHER_TOKEN);
    expect(body).toEqual({ contacts: [] });
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 1 });
  });

  it('tanpa/salah token → 401, jaringan tak dikenal → 400', async () => {
    const { get } = contactsApp();
    expect((await get('', null)).res.status).toBe(401);
    expect((await get('', 'pendek')).res.status).toBe(401);
    const bad = await get('?network=tron');
    expect(bad.res.status).toBe(400);
    expect(bad.body).toMatchObject({ error: 'unknown_network' });
  });

  it('preflight CORS mengizinkan header Authorization', async () => {
    const { app } = contactsApp();
    const res = await app.request('/v1/contacts', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://contoh.app',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    });
    expect(res.headers.get('access-control-allow-headers')).toContain('Authorization');
  });
});

describe('tabel contacts', () => {
  it('kontak yang sama tidak bisa dobel (termasuk "semua jaringan")', () => {
    const { store } = contactsApp();
    const userId = store.ensureUserId(TOKEN);
    store.add(userId, { name: 'A', address: EVM, chainType: 'evm', networkId: null });
    expect(() =>
      store.add(userId, { name: 'B', address: EVM, chainType: 'evm', networkId: null }),
    ).toThrow(/UNIQUE/);
    expect(() =>
      store.add(userId, { name: '   ', address: SOL, chainType: 'solana', networkId: null }),
    ).toThrow(/CHECK/);
  });
});
