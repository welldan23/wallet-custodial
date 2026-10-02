import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { MVP_NETWORKS, MVP_TOKENS } from '../src/catalog/mvp.js';
import { ContactStore } from '../src/contacts/store.js';
import { parseContactAddress, parseContactInput } from '../src/contacts/validate.js';

import { makeDeps, seededDb, TEST_NOW } from './helpers.js';

const EVM = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const SOL = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const TRON = 'TJYeasTPa6gpEEfYqP2kp8vR9n2N3nZ5uN';
const BTC_LEGACY = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
const BTC_BECH32 = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const catalog = { networks: MVP_NETWORKS, tokens: MVP_TOKENS };
const EVM_NETWORKS = MVP_NETWORKS.filter((network) => network.chainType === 'evm').map(
  (network) => network.id,
);

describe('parseContactAddress per tipe jaringan', () => {
  it.each([
    ['evm', EVM.toLowerCase(), { ok: true, address: EVM }],
    ['evm', `  ${EVM}\n`, { ok: true, address: EVM }],
    ['evm', '0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045', { ok: false, reason: 'evm_checksum' }],
    ['evm', '0x12345', { ok: false, reason: 'evm_format' }],
    ['evm', SOL, { ok: false, reason: 'solana_on_evm' }],
    ['evm', TRON, { ok: false, reason: 'tron' }],
    ['evm', BTC_LEGACY, { ok: false, reason: 'bitcoin' }],
    ['evm', BTC_BECH32, { ok: false, reason: 'bitcoin' }],
    ['evm', 'vitalik.eth', { ok: false, reason: 'unknown' }],
    ['evm', '0x0000000000000000000000000000000000000000', { ok: false, reason: 'burn_address' }],
    ['evm', '0x000000000000000000000000000000000000dEaD', { ok: false, reason: 'burn_address' }],
    ['solana', SOL, { ok: true, address: SOL }],
    ['solana', EVM, { ok: false, reason: 'evm_on_solana' }],
    ['solana', TRON, { ok: false, reason: 'tron' }],
    ['solana', BTC_LEGACY, { ok: false, reason: 'bitcoin' }],
    ['solana', SOL.slice(0, -1) + '0', { ok: false, reason: 'solana_format' }],
    ['solana', '11111111111111111111111111111111', { ok: false, reason: 'program_address' }],
    [
      'solana',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      { ok: false, reason: 'program_address' },
    ],
    ['solana', '', { ok: false, reason: 'missing' }],
  ] as const)('%s %s', (chainType, address, expected) => {
    expect(parseContactAddress(address, chainType)).toEqual(expected);
  });
});

describe('alamat dicek sesuai jaringan yang dipilih', () => {
  it.each(EVM_NETWORKS)('jaringan EVM %s: alamat EVM diterima, Solana ditolak', (networkId) => {
    expect(parseContactInput({ name: 'A', address: EVM, networkId }, catalog)).toMatchObject({
      ok: true,
      contact: { chainType: 'evm', networkId },
    });
    expect(parseContactInput({ name: 'A', address: SOL, networkId }, catalog)).toMatchObject({
      ok: false,
      reason: 'solana_on_evm',
    });
  });

  it('jaringan Solana: alamat Solana diterima, EVM ditolak', () => {
    expect(parseContactInput({ name: 'A', address: SOL, networkId: 'solana' }, catalog).ok).toBe(
      true,
    );
    expect(
      parseContactInput({ name: 'A', address: EVM, networkId: 'solana' }, catalog),
    ).toMatchObject({ ok: false, reason: 'evm_on_solana' });
  });

  it('tanpa jaringan: Tron ditebak sebagai non-0x lalu ditolak dengan alasan tron', () => {
    expect(parseContactInput({ name: 'A', address: TRON }, catalog)).toMatchObject({
      ok: false,
      reason: 'tron',
    });
  });

  it.each([
    ['0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 'arbitrum', 'USDC'],
    // Kontrak token jaringan lain tetap ditolak untuk kontak "semua EVM".
    ['0xdac17f958d2ee523a2206206994597c13d831ec7', null, 'USDT'],
    ['0x6B175474E89094C44Da98b954EedeAC495271d0F', 'base', 'DAI'],
    ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'solana', 'USDC'],
    ['Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', null, 'USDT'],
  ])('alamat kontrak/mint token %s (%s) ditolak', (address, networkId, symbol) => {
    expect(parseContactInput({ name: 'A', address, networkId }, catalog)).toEqual({
      ok: false,
      error: 'invalid_address',
      reason: 'token_contract',
      tokenSymbol: symbol,
    });
  });
});

describe('endpoint memakai validasi yang sama', () => {
  const TOKEN = 'b3f1c0de-7a9e-4c11-9d2a-5e6f7a8b9c0d';
  function setup() {
    const db = seededDb();
    const store = new ContactStore(db, () => TEST_NOW);
    const app = createApp({
      ...makeDeps(db, {}),
      priceStaleAfterMs: 15 * 60_000,
      logRequests: false,
      contactStore: store,
    });
    const call = async (method: 'POST' | 'PATCH', path: string, body: unknown) => {
      const res = await app.request(path, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Device ${TOKEN}` },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: (await res.json()) as Record<string, any> };
    };
    return { call };
  }

  it('POST: kontrak USDC ditolak dengan simbol tokennya', async () => {
    const { call } = setup();
    const res = await call('POST', '/v1/contacts', {
      name: 'USDC',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      networkId: 'ethereum',
    });
    expect(res).toEqual({
      status: 400,
      body: {
        error: 'invalid_address',
        reason: 'token_contract',
        tokenSymbol: 'USDC',
        message: expect.any(String),
      },
    });
  });

  it('PATCH: ganti ke alamat burn / pindah jaringan yang tidak cocok ditolak', async () => {
    const { call } = setup();
    const created = await call('POST', '/v1/contacts', { name: 'Ani', address: EVM });
    const path = `/v1/contacts/${created.body.contact.id}`;
    expect(
      (await call('PATCH', path, { address: '0x0000000000000000000000000000000000000000' })).body,
    ).toMatchObject({ reason: 'burn_address' });
    expect((await call('PATCH', path, { networkId: 'solana' })).body).toMatchObject({
      reason: 'evm_on_solana',
    });
    expect((await call('PATCH', path, { networkId: 'polygon' })).status).toBe(200);
  });
});
