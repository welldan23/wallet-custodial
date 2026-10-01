import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import type { BalanceSummary } from '../src/services/balance-summary.js';

import { EVM_OWNER, fakeReader, makeDeps, seededDb, SOLANA_OWNER } from './helpers.js';

function testApp() {
  const db = seededDb();
  return createApp({
    ...makeDeps(db, {
      ethereum: fakeReader({ 'usdc-ethereum': 2_500_000n }).reader,
      solana: fakeReader({ 'usdt-solana': 1_000_000n }).reader,
    }),
    logRequests: false,
  });
}

describe('API', () => {
  it('GET /health', async () => {
    const res = await testApp().request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('menolak permintaan tanpa alamat', async () => {
    const res = await testApp().request('/v1/balances/summary');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'missing_address' });
  });

  it.each([
    ['evm=0x123', 'invalid_evm_address'],
    ['evm=bukan-alamat', 'invalid_evm_address'],
    ['solana=0OIl-bukan-base58', 'invalid_solana_address'],
    [`evm=${EVM_OWNER}&solana=abc`, 'invalid_solana_address'],
  ])('menolak alamat tidak valid (%s)', async (query, error) => {
    const res = await testApp().request(`/v1/balances/summary?${query}`);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error });
  });

  it('mengembalikan ringkasan untuk alamat valid', async () => {
    const lowercase = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';
    const res = await testApp().request(
      `/v1/balances/summary?evm=${lowercase}&solana=${SOLANA_OWNER}`,
      { headers: { Origin: 'https://contoh.app' } },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');

    const body = (await res.json()) as BalanceSummary;
    // Alamat EVM dinormalisasi ke format checksum.
    expect(body.owner).toEqual({
      evm: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      solana: SOLANA_OWNER,
    });
    expect(body.totalUsd).toBe(3.5);
    expect(body.balances.find((item) => item.tokenId === 'usdt-solana')).toMatchObject({
      amount: '1',
      valueUsd: 1,
    });
  });

  it('404 dalam format JSON', async () => {
    const res = await testApp().request('/nggak-ada');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
