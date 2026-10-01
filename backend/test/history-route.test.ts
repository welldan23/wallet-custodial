import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createWalletKey } from '../src/lib/wallet-key.js';
import { monthRange } from '../src/lib/month.js';
import { TransactionStore, type ImportedTransaction } from '../src/transactions/store.js';

import { makeDeps, seededDb, SOLANA_OWNER, TEST_NOW } from './helpers.js';

const EVM = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const walletKey = createWalletKey('tes');
const WIB = 420;

const row = (
  txHash: string,
  blockTime: string,
  overrides: Partial<ImportedTransaction> = {},
): ImportedTransaction => ({
  walletKey: walletKey(EVM),
  networkId: 'arbitrum',
  tokenId: 'usdc-arbitrum',
  type: 'receive',
  status: 'success',
  amountRaw: 10_000_000n,
  amountUsd: 10,
  counterpartyAddress: '0x5b7E0D3A9F1C4e2a6B8d0f1E3C5a7b9d1E3F5a7C',
  txHash,
  blockTime,
  ...overrides,
});

function historyApp() {
  const db = seededDb();
  const store = new TransactionStore(db, () => TEST_NOW);
  store.importFromChain([
    // 30 Sep 18:00 UTC = 1 Okt 01:00 WIB → bulan Oktober untuk pengguna WIB.
    row('0xokt-wib', '2026-09-30T18:00:00.000Z', { amountUsd: 500, amountRaw: 500_000_000n }),
    row('0xsep-kirim', '2026-09-20T10:00:00.000Z', { type: 'send', amountUsd: 45 }),
    row('0xsep-gagal', '2026-09-27T13:30:00.000Z', {
      type: 'send',
      status: 'failed',
      amountUsd: 60,
    }),
    row('0xsep-masuk', '2026-09-02T03:10:00.000Z', { amountUsd: 59.61 }),
    row('0xagu', '2026-08-05T07:50:00.000Z', { amountUsd: 350 }),
    row('sigSol', '2026-09-21T06:00:00.000Z', {
      walletKey: walletKey(SOLANA_OWNER),
      networkId: 'solana',
      tokenId: 'usdc-solana',
      amountUsd: 38,
    }),
    row('0xorang-lain', '2026-09-10T00:00:00.000Z', {
      walletKey: walletKey('0x2222222222222222222222222222222222222222'),
    }),
  ]);
  store.insertSwapPending({
    walletKey: walletKey(EVM),
    networkId: 'arbitrum',
    tokenId: 'usdc-arbitrum',
    amountRaw: 80_000_000n,
    amountUsd: 80,
    counterpartyAddress: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    txHash: '0xswap',
    provider: 'lifi',
    toNetworkId: 'arbitrum',
    toTokenId: 'usdt-arbitrum',
    quotedAmountRaw: 79_900_000n,
    minAmountRaw: 79_500_000n,
    slippageBps: 50,
  }); // created_at = TEST_NOW (1 Okt 11:00 UTC)

  const app = createApp({
    ...makeDeps(db, {}),
    priceStaleAfterMs: 60_000,
    logRequests: false,
    transactions: { broadcasters: new Map(), transactionStore: store, walletKey },
  });
  const get = async (query: string) => {
    const res = await app.request(`/v1/history?${query}`);
    return { res, body: (await res.json()) as Record<string, any> };
  };
  return { get };
}

const hashes = (body: Record<string, any>) =>
  body.transactions.map((tx: { txHash: string }) => tx.txHash);

describe('rentang bulan lokal', () => {
  it('Oktober WIB = 30 Sep 17:00 UTC sampai 31 Okt 17:00 UTC', () => {
    expect(monthRange('2026-10', WIB)).toEqual({
      from: '2026-09-30T17:00:00.000Z',
      to: '2026-10-31T17:00:00.000Z',
    });
    expect(monthRange('2026-12', 0)).toEqual({
      from: '2026-12-01T00:00:00.000Z',
      to: '2027-01-01T00:00:00.000Z',
    });
  });
});

describe('GET /v1/history', () => {
  it('semua jenis milik alamat EVM + Solana, terbaru dulu, + ringkasan & daftar bulan', async () => {
    const { get } = historyApp();
    const { res, body } = await get(
      `evm=${EVM.toLowerCase()}&solana=${SOLANA_OWNER}&tzOffset=${WIB}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(hashes(body)).toEqual([
      '0xswap',
      '0xokt-wib',
      '0xsep-gagal',
      'sigSol',
      '0xsep-kirim',
      '0xsep-masuk',
      '0xagu',
    ]);
    expect(body.transactions[0]).toMatchObject({
      type: 'swap',
      source: 'app',
      swap: { toSymbol: 'USDT' },
    });
    expect(body.transactions[1]).toMatchObject({
      type: 'receive',
      source: 'chain',
      blockTime: '2026-09-30T18:00:00.000Z',
    });
    expect(body.months).toEqual(['2026-10', '2026-09', '2026-08']);
    expect(body.summary).toEqual({
      month: null,
      count: 7,
      inUsd: 947.61,
      outUsd: 45,
      swaps: 1,
      pending: 1,
      failed: 1,
    });
  });

  it('filter bulan memakai zona waktu pengguna', async () => {
    const { get } = historyApp();
    const wib = await get(`evm=${EVM}&month=2026-09&tzOffset=${WIB}`);
    expect(hashes(wib.body)).toEqual(['0xsep-gagal', '0xsep-kirim', '0xsep-masuk']);
    expect(wib.body.summary).toMatchObject({
      month: '2026-09',
      count: 3,
      inUsd: 59.61,
      outUsd: 45,
      failed: 1,
    });

    // Di UTC, transaksi 30 Sep 18:00 masih September.
    const utc = await get(`evm=${EVM}&month=2026-09`);
    expect(hashes(utc.body)).toContain('0xokt-wib');
  });

  it('filter jenis + paging', async () => {
    const { get } = historyApp();
    const first = await get(`evm=${EVM}&type=receive&limit=2`);
    expect(hashes(first.body)).toEqual(['0xokt-wib', '0xsep-masuk']);
    expect(first.body.summary.count).toBe(3);
    const next = await get(
      `evm=${EVM}&type=receive&limit=2&before=${encodeURIComponent(first.body.nextBefore)}`,
    );
    expect(hashes(next.body)).toEqual(['0xagu']);
    expect(next.body.nextBefore).toBeNull();
    // Halaman lanjutan tidak mengulang ringkasan.
    expect(next.body).not.toHaveProperty('summary');
  });

  it('bulan tanpa transaksi → kosong dengan ringkasan nol', async () => {
    const { get } = historyApp();
    const { body } = await get(`evm=${EVM}&month=2026-07&tzOffset=${WIB}`);
    expect(body.transactions).toEqual([]);
    expect(body.summary).toEqual({
      month: '2026-07',
      count: 0,
      inUsd: 0,
      outUsd: 0,
      swaps: 0,
      pending: 0,
      failed: 0,
    });
  });

  it.each([
    ['', 'missing_address'],
    ['evm=0x12', 'invalid_evm_address'],
    [`evm=${EVM}&month=2026-13`, 'invalid_month'],
    [`evm=${EVM}&month=26-09`, 'invalid_month'],
    [`evm=${EVM}&tzOffset=900`, 'invalid_tz_offset'],
    [`evm=${EVM}&tzOffset=7.5`, 'invalid_tz_offset'],
    [`evm=${EVM}&type=mint`, 'invalid_type'],
    [`evm=${EVM}&limit=0`, 'invalid_limit'],
    [`evm=${EVM}&before=abc`, 'invalid_cursor'],
  ])('menolak %s', async (query, error) => {
    const { get } = historyApp();
    const { res, body } = await get(query);
    expect(res.status).toBe(400);
    expect(body.error).toBe(error);
  });
});
