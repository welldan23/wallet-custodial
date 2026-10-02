import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { ContactStore, MAX_CONTACTS_PER_USER } from '../src/contacts/store.js';
import { parseContactInput } from '../src/contacts/validate.js';
import { MVP_NETWORKS, MVP_TOKENS } from '../src/catalog/mvp.js';

import { makeDeps, seededDb, TEST_NOW } from './helpers.js';

const TOKEN = 'b3f1c0de-7a9e-4c11-9d2a-5e6f7a8b9c0d';
const EVM = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const SOL = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

function setup() {
  const db = seededDb();
  const store = new ContactStore(db, () => TEST_NOW);
  const app = createApp({
    ...makeDeps(db, {}),
    priceStaleAfterMs: 15 * 60_000,
    logRequests: false,
    contactStore: store,
  });
  const post = async (body: unknown, token: string | null = TOKEN, raw?: string) => {
    const res = await app.request('/v1/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Device ${token}` } : {}),
      },
      body: raw ?? JSON.stringify(body),
    });
    return { res, body: (await res.json()) as Record<string, any> };
  };
  const list = async () => {
    const res = await app.request('/v1/contacts', {
      headers: { Authorization: `Device ${TOKEN}` },
    });
    return ((await res.json()) as { contacts: Record<string, any>[] }).contacts;
  };
  return { db, store, post, list };
}

describe('parseContactInput', () => {
  const parse = (body: unknown) => parseContactInput(body, { networks: MVP_NETWORKS, tokens: MVP_TOKENS });

  it('merapikan nama & menormalkan alamat EVM ke checksum', () => {
    expect(parse({ name: '  Ani \n  Wijaya ', address: ` ${EVM.toLowerCase()} ` })).toEqual({
      ok: true,
      contact: {
        name: 'Ani Wijaya',
        address: EVM,
        chainType: 'evm',
        networkId: null,
        isFavorite: false,
      },
    });
  });

  it('tanpa jaringan: tipe ditebak dari bentuk alamat', () => {
    expect(parse({ name: 'Budi', address: SOL })).toMatchObject({
      ok: true,
      contact: { chainType: 'solana', networkId: null },
    });
  });

  it.each([
    [{ address: EVM }, { error: 'invalid_name', reason: 'missing' }],
    [
      { name: '   ', address: EVM },
      { error: 'invalid_name', reason: 'empty' },
    ],
    [
      { name: 'x'.repeat(41), address: EVM },
      { error: 'invalid_name', reason: 'too_long' },
    ],
    [
      { name: 'a\u0000b', address: EVM },
      { error: 'invalid_name', reason: 'invalid_characters' },
    ],
    [{ name: 'A' }, { error: 'invalid_address', reason: 'missing' }],
    [
      { name: 'A', address: '0x123' },
      { error: 'invalid_address', reason: 'evm_format' },
    ],
    [
      { name: 'A', address: '0xd8da6BF26964aF9D7eEd9e03E53415D37aA96045', networkId: 'base' },
      { error: 'invalid_address', reason: 'evm_checksum' },
    ],
    [
      { name: 'A', address: SOL, networkId: 'arbitrum' },
      { error: 'invalid_address', reason: 'solana_on_evm' },
    ],
    [
      { name: 'A', address: EVM, networkId: 'solana' },
      { error: 'invalid_address', reason: 'evm_on_solana' },
    ],
    [
      { name: 'A', address: 'bukan-alamat' },
      { error: 'invalid_address', reason: 'solana_format' },
    ],
    [{ name: 'A', address: EVM, networkId: 'tron' }, { error: 'unknown_network' }],
    [{ name: 'A', address: EVM, isFavorite: 'ya' }, { error: 'invalid_favorite' }],
  ])('%j → %j', (body, expected) => {
    expect(parse(body)).toEqual({ ok: false, ...expected });
  });

  it('nama 40 karakter (termasuk emoji dihitung per karakter) diterima', () => {
    expect(parse({ name: '😀'.repeat(40), address: EVM }).ok).toBe(true);
    expect(parse({ name: '😀'.repeat(41), address: EVM }).ok).toBe(false);
  });
});

describe('POST /v1/contacts', () => {
  it('201 + kontak tersimpan dan muncul di daftar', async () => {
    const { post, list } = setup();
    const { res, body } = await post({
      name: 'Deposit Tokocrypto',
      address: EVM.toLowerCase(),
      networkId: 'arbitrum',
      isFavorite: true,
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body.contact).toEqual({
      id: expect.any(String),
      name: 'Deposit Tokocrypto',
      address: EVM,
      chainType: 'evm',
      networkId: 'arbitrum',
      isFavorite: true,
      createdAt: TEST_NOW.toISOString(),
      updatedAt: TEST_NOW.toISOString(),
    });
    expect(await list()).toEqual([body.contact]);
  });

  it('perangkat baru otomatis didaftarkan (hanya hash token)', async () => {
    const { db, post } = setup();
    await post({ name: 'Budi', address: SOL });
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({ n: 1 });
  });

  it('409 dobel: alamat sama, jaringan tumpang tindih, beda huruf besar-kecil', async () => {
    const { post } = setup();
    const first = await post({ name: 'Tokocrypto', address: EVM, networkId: 'arbitrum' });
    const dup = await post({ name: 'Lagi', address: EVM.toLowerCase() });
    expect(dup.res.status).toBe(409);
    expect(dup.body).toMatchObject({
      error: 'duplicate_contact',
      existing: { id: first.body.contact.id, name: 'Tokocrypto' },
    });
    // Jaringan spesifik lain boleh.
    expect((await post({ name: 'Eth', address: EVM, networkId: 'ethereum' })).res.status).toBe(201);
  });

  it('400 dengan alasan yang bisa dipetakan ke pesan di aplikasi', async () => {
    const { post, list } = setup();
    const { res, body } = await post({ name: 'A', address: SOL, networkId: 'base' });
    expect(res.status).toBe(400);
    expect(body).toEqual({
      error: 'invalid_address',
      reason: 'solana_on_evm',
      message: expect.any(String),
    });
    expect(await list()).toEqual([]);
  });

  it('401 tanpa token, 400 body bukan JSON objek, 413 body terlalu besar', async () => {
    const { post } = setup();
    expect((await post({ name: 'A', address: EVM }, null)).res.status).toBe(401);
    expect((await post(null, TOKEN, 'bukan json')).body.error).toBe('invalid_json');
    expect((await post([1, 2])).body.error).toBe('invalid_json');
    const big = await post({ name: 'A', address: EVM, junk: 'x'.repeat(5000) });
    expect(big.res.status).toBe(413);
  });

  it('409 kalau sudah mencapai batas kontak per perangkat', async () => {
    const { store, post } = setup();
    const userId = store.ensureUserId(TOKEN);
    for (let i = 0; i < MAX_CONTACTS_PER_USER; i++) {
      store.add(userId, {
        name: `K${i}`,
        address: `0x${i.toString(16).padStart(40, '0')}`,
        chainType: 'evm',
        networkId: null,
      });
    }
    const { res, body } = await post({ name: 'Satu lagi', address: EVM });
    expect(res.status).toBe(409);
    expect(body.error).toBe('contact_limit');
  });

  it('preflight CORS mengizinkan POST', async () => {
    const { db } = setup();
    const app = createApp({
      ...makeDeps(db, {}),
      priceStaleAfterMs: 1,
      logRequests: false,
      contactStore: new ContactStore(db),
    });
    const res = await app.request('/v1/contacts', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://contoh.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
    });
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });
});
