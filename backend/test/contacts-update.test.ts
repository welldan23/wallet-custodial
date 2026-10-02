import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { ContactStore } from '../src/contacts/store.js';

import { makeDeps, seededDb, TEST_NOW } from './helpers.js';

const TOKEN = 'b3f1c0de-7a9e-4c11-9d2a-5e6f7a8b9c0d';
const OTHER_TOKEN = 'Zx9_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const EVM = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const EVM_2 = '0x1111111111111111111111111111111111111111';
const SOL = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const LATER = new Date('2026-10-01T12:00:00.000Z');

function setup() {
  const db = seededDb();
  let now = TEST_NOW;
  const store = new ContactStore(db, () => now);
  const app = createApp({
    ...makeDeps(db, {}),
    priceStaleAfterMs: 15 * 60_000,
    logRequests: false,
    contactStore: store,
  });
  const userId = store.ensureUserId(TOKEN);
  const indodax = store.add(userId, {
    name: 'Indodax',
    address: EVM,
    chainType: 'evm',
    networkId: 'ethereum',
  });
  const budi = store.add(userId, {
    name: 'Budi',
    address: SOL,
    chainType: 'solana',
    networkId: null,
  });
  now = LATER;

  const send = async (
    method: 'PATCH' | 'DELETE',
    id: string,
    body?: unknown,
    token: string | null = TOKEN,
  ) => {
    const res = await app.request(`/v1/contacts/${id}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Device ${token}` } : {}),
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    return { res, body: (text ? JSON.parse(text) : null) as Record<string, any> | null };
  };
  return { app, db, store, userId, indodax, budi, send };
}

describe('PATCH /v1/contacts/:id', () => {
  it('ubah sebagian: hanya field yang dikirim berubah, updatedAt maju', async () => {
    const { send, indodax } = setup();
    const { res, body } = await send('PATCH', indodax.id, {
      name: '  Deposit  Indodax ',
      isFavorite: true,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body!.contact).toEqual({
      ...indodax,
      name: 'Deposit Indodax',
      isFavorite: true,
      updatedAt: LATER.toISOString(),
    });
  });

  it('ganti jaringan ke "semua EVM" dan alamat (dinormalkan ke checksum)', async () => {
    const { send, indodax } = setup();
    const { body } = await send('PATCH', indodax.id, {
      address: EVM_2.toLowerCase(),
      networkId: null,
    });
    expect(body!.contact).toMatchObject({ address: EVM_2, networkId: null, chainType: 'evm' });
  });

  it('ganti alamat EVM → Solana bersama jaringannya', async () => {
    const { send, indodax } = setup();
    const ok = await send('PATCH', indodax.id, {
      address: 'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
      networkId: 'solana',
    });
    // Alamat milik kontak lain (Budi, semua jaringan Solana) = dobel.
    expect((await send('PATCH', indodax.id, { address: SOL })).res.status).toBe(409);
    expect(ok.body!.contact).toMatchObject({ chainType: 'solana', networkId: 'solana' });
  });

  it('400: hasil gabungan tidak valid (alamat Solana di jaringan lama Ethereum, nama kosong)', async () => {
    const { send, indodax, store, userId } = setup();
    const bad = await send('PATCH', indodax.id, {
      address: 'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    });
    expect(bad.res.status).toBe(400);
    expect(bad.body).toMatchObject({ error: 'invalid_address', reason: 'solana_on_evm' });
    expect((await send('PATCH', indodax.id, { name: ' ' })).body).toMatchObject({
      error: 'invalid_name',
      reason: 'empty',
    });
    expect(store.get(userId, indodax.id)).toEqual(indodax);
  });

  it('400 tanpa field yang bisa diubah / body bukan objek', async () => {
    const { send, indodax } = setup();
    expect((await send('PATCH', indodax.id, { id: 'lain', createdAt: 'x' })).body).toMatchObject({
      error: 'empty_update',
    });
    expect((await send('PATCH', indodax.id, 'bukan json')).body).toMatchObject({
      error: 'invalid_json',
    });
  });

  it('409 kalau jadi dobel dengan kontak lain, tapi tidak dengan dirinya sendiri', async () => {
    const { send, indodax, budi, store, userId } = setup();
    store.add(userId, { name: 'Lain', address: EVM_2, chainType: 'evm', networkId: 'base' });
    // Simpan ulang dengan isi sama = bukan dobel.
    expect((await send('PATCH', indodax.id, { address: EVM.toLowerCase() })).res.status).toBe(200);
    const dup = await send('PATCH', indodax.id, { address: EVM_2, networkId: null });
    expect(dup.res.status).toBe(409);
    expect(dup.body).toMatchObject({ error: 'duplicate_contact', existing: { name: 'Lain' } });
    const dup2 = await send('PATCH', budi.id, { address: EVM, networkId: 'ethereum' });
    expect(dup2.body).toMatchObject({ error: 'duplicate_contact', existing: { id: indodax.id } });
  });

  it('404 untuk kontak perangkat lain / id tak dikenal; 401 tanpa token', async () => {
    const { send, indodax, store } = setup();
    store.ensureUserId(OTHER_TOKEN);
    expect((await send('PATCH', indodax.id, { name: 'X' }, OTHER_TOKEN)).res.status).toBe(404);
    expect((await send('PATCH', 'tidak-ada', { name: 'X' })).body).toMatchObject({
      error: 'contact_not_found',
    });
    expect((await send('PATCH', indodax.id, { name: 'X' }, null)).res.status).toBe(401);
  });
});

describe('DELETE /v1/contacts/:id', () => {
  it('204 lalu hilang dari daftar; hapus kedua kali 404', async () => {
    const { send, indodax, budi, store, userId } = setup();
    const first = await send('DELETE', indodax.id);
    expect(first.res.status).toBe(204);
    expect(first.body).toBeNull();
    expect(store.list(userId).map((contact) => contact.id)).toEqual([budi.id]);
    expect((await send('DELETE', indodax.id)).res.status).toBe(404);
  });

  it('perangkat lain tidak bisa menghapus; 401 tanpa token', async () => {
    const { send, indodax, store, userId } = setup();
    expect((await send('DELETE', indodax.id, undefined, OTHER_TOKEN)).res.status).toBe(404);
    expect((await send('DELETE', indodax.id, undefined, null)).res.status).toBe(401);
    expect(store.get(userId, indodax.id)).not.toBeNull();
  });

  it('setelah dihapus, alamatnya boleh disimpan lagi', async () => {
    const { send, indodax, store, userId } = setup();
    await send('DELETE', indodax.id);
    expect(() =>
      store.add(userId, { name: 'Baru', address: EVM, chainType: 'evm', networkId: null }),
    ).not.toThrow();
  });

  it('preflight CORS mengizinkan PATCH & DELETE', async () => {
    const { app, indodax } = setup();
    const res = await app.request(`/v1/contacts/${indodax.id}`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://contoh.app',
        'Access-Control-Request-Method': 'DELETE',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
    });
    const allowed = res.headers.get('access-control-allow-methods') ?? '';
    expect(allowed).toContain('PATCH');
    expect(allowed).toContain('DELETE');
  });
});
