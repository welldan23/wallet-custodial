import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createWalletKey } from '../src/lib/wallet-key.js';
import { checkAddress } from '../src/transactions/lookalike.js';
import { TransactionStore } from '../src/transactions/store.js';

import { makeDeps, seededDb, SOLANA_OWNER, TEST_NOW } from './helpers.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const FRIEND = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
// Awal "d8dA6" dan akhir "96045" sama dengan FRIEND, tengahnya beda.
const POISON = '0xd8dA6000000000000000000000000000000960450'.slice(0, 37) + '96045';
const STRANGER = '0x2222222222222222222222222222222222222222';
const SOL_FRIEND = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

describe('aturan alamat mirip', () => {
  const known = [{ address: FRIEND }];

  it('persis sama → known (EVM tidak peka huruf besar-kecil)', () => {
    expect(checkAddress(FRIEND.toLowerCase(), known).result).toBe('known');
  });

  it('awal & akhir sama tapi beda → lookalike dengan jumlah karakter sama', () => {
    const check = checkAddress(POISON, known);
    expect(check).toMatchObject({ result: 'lookalike', prefix: 5, suffix: 5 });
  });

  it('kemiripan kecil (kebetulan) tidak dianggap mirip', () => {
    expect(checkAddress('0xd8d0000000000000000000000000000000000045', known).result).toBe('new');
    expect(checkAddress(STRANGER, known).result).toBe('new');
  });

  it('Solana peka huruf besar-kecil', () => {
    expect(checkAddress(SOL_FRIEND.toLowerCase(), [{ address: SOL_FRIEND }]).result).not.toBe(
      'known',
    );
  });

  it('pilih kecocokan paling panjang', () => {
    // 4 awal + 4 akhir sama dengan POISON (total 8) — kalah dari FRIEND (5 + 5).
    const weaker = `0xd8dA${'f'.repeat(31)}a6045`;
    const check = checkAddress(POISON, [{ address: weaker }, { address: FRIEND }]);
    expect(check.result).toBe('lookalike');
    if (check.result === 'lookalike') expect(check.match.address).toBe(FRIEND);
  });
});

function checkApp() {
  const db = seededDb();
  const walletKey = createWalletKey('rahasia-tes');
  const store = new TransactionStore(db, () => TEST_NOW);
  const app = createApp({
    ...makeDeps(db, {}),
    priceStaleAfterMs: 15 * 60_000,
    logRequests: false,
    transactions: { broadcasters: new Map(), transactionStore: store, walletKey },
  });
  let n = 0;
  const record = (
    owner: string,
    networkId: string,
    tokenId: string,
    counterpartyAddress: string,
    overrides: { type?: 'send' | 'receive'; failed?: boolean } = {},
  ) => {
    n += 1;
    const { transaction } = store.insertPending({
      walletKey: walletKey(owner),
      networkId,
      tokenId,
      type: overrides.type ?? 'send',
      amountRaw: 1n,
      amountUsd: 1,
      counterpartyAddress,
      txHash: `hash-${n}`,
    });
    if (overrides.failed) store.setStatus(transaction.id, 'failed');
  };
  const check = async (query: string) => {
    const res = await app.request(`/v1/address-check?${query}`);
    return { res, body: (await res.json()) as Record<string, unknown> };
  };
  return { record, check };
}

describe('GET /v1/address-check', () => {
  it('alamat yang pernah dikirimi di jaringan EVM lain tetap dikenali', async () => {
    const { record, check } = checkApp();
    record(OWNER, 'ethereum', 'usdc-ethereum', FRIEND);
    record(OWNER, 'base', 'usdc-base', FRIEND);

    const { res, body } = await check(
      `network=arbitrum&owner=${OWNER.toUpperCase().replace('0X', '0x')}&to=${FRIEND.toLowerCase()}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({
      result: 'known',
      match: {
        address: FRIEND,
        timesUsed: 2,
        lastUsedAt: TEST_NOW.toISOString(),
        networkIds: ['base', 'ethereum'],
      },
      checkedAddresses: 1,
    });
  });

  it('alamat mirip dari riwayat → lookalike', async () => {
    const { record, check } = checkApp();
    record(OWNER, 'arbitrum', 'usdc-arbitrum', FRIEND);
    const { body } = await check(`network=arbitrum&owner=${OWNER}&to=${POISON}`);
    expect(body).toMatchObject({
      result: 'lookalike',
      match: { address: FRIEND, samePrefix: 5, sameSuffix: 5 },
    });
  });

  it('abaikan kiriman gagal, transaksi masuk, wallet lain, dan tipe jaringan lain', async () => {
    const { record, check } = checkApp();
    record(OWNER, 'arbitrum', 'usdc-arbitrum', FRIEND, { failed: true });
    record(OWNER, 'arbitrum', 'usdc-arbitrum', FRIEND, { type: 'receive' });
    record(STRANGER, 'arbitrum', 'usdc-arbitrum', FRIEND);
    record(SOLANA_OWNER, 'solana', 'usdc-solana', SOL_FRIEND);

    const { body } = await check(`network=arbitrum&owner=${OWNER}&to=${POISON}`);
    expect(body).toEqual({ result: 'new', match: null, checkedAddresses: 0 });
  });

  it('Solana memakai riwayat Solana', async () => {
    const { record, check } = checkApp();
    record(SOLANA_OWNER, 'solana', 'usdc-solana', SOL_FRIEND);
    const { body } = await check(`network=solana&owner=${SOLANA_OWNER}&to=${SOL_FRIEND}`);
    expect(body).toMatchObject({ result: 'known', match: { networkIds: ['solana'] } });
  });

  it.each([
    ['network=tron&owner=x&to=y', 'unknown_network'],
    [`network=arbitrum&owner=0x12&to=${FRIEND}`, 'invalid_owner'],
    [`network=arbitrum&owner=${OWNER}&to=${SOL_FRIEND}`, 'invalid_to'],
    [`network=solana&owner=${OWNER}&to=${SOL_FRIEND}`, 'invalid_owner'],
  ])('menolak %s', async (query, error) => {
    const { res, body } = await checkApp().check(query);
    expect(res.status).toBe(400);
    expect(body).toMatchObject({ error });
  });
});
