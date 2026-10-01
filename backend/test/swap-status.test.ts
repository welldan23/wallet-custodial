import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { MVP_NETWORKS, MVP_TOKENS } from '../src/catalog/mvp.js';
import { createWalletKey } from '../src/lib/wallet-key.js';
import {
  createSwapProgressChecker,
  lifiProgressChecker,
  receivedFromBalances,
  type SwapProgress,
} from '../src/swap/progress.js';
import type { ChainTxStatus } from '../src/transactions/status.js';
import { TransactionStore, type NewSwap } from '../src/transactions/store.js';
import type { SwapTransaction } from '../src/types.js';

import { makeDeps, seededDb, SOLANA_OWNER, TEST_NOW } from './helpers.js';

const EVM_OWNER = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const network = (id: string) => MVP_NETWORKS.find((item) => item.id === id)!;
const token = (id: string) => MVP_TOKENS.find((item) => item.id === id)!;
const walletKey = createWalletKey('tes');

const swapInput = (overrides: Partial<NewSwap> = {}): NewSwap => ({
  walletKey: walletKey(EVM_OWNER),
  networkId: 'arbitrum',
  tokenId: 'usdc-arbitrum',
  amountRaw: 100_000_000n,
  amountUsd: 100,
  counterpartyAddress: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
  txHash: '0xaaa',
  provider: 'lifi',
  toNetworkId: 'arbitrum',
  toTokenId: 'usdt-arbitrum',
  quotedAmountRaw: 99_770_000n,
  minAmountRaw: 99_270_000n,
  slippageBps: 50,
  ...overrides,
});

const json = (status: number, body: unknown) =>
  vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status }),
  );

describe('status LI.FI', () => {
  const swap = { txHash: '0xaaa' } as SwapTransaction;
  const ctx = {
    fromNetwork: network('arbitrum'),
    toNetwork: network('solana'),
    toToken: token('usdc-solana'),
  };
  const check = (status: number, body: unknown) =>
    lifiProgressChecker({ timeoutMs: 1_000, fetch: json(status, body) })(swap, ctx);

  it('memanggil /v1/status dengan chain asal & tujuan (Solana = SOL)', async () => {
    const fetch = json(200, { status: 'PENDING' });
    await lifiProgressChecker({ timeoutMs: 1_000, fetch })(swap, ctx);
    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      txHash: '0xaaa',
      fromChain: '42161',
      toChain: 'SOL',
    });
  });

  it.each<[string, number, unknown, SwapProgress]>([
    ['404 → masih jalan', 404, { code: 1003 }, { state: 'pending' }],
    ['PENDING', 200, { status: 'PENDING' }, { state: 'pending', bridgeStatus: 'pending' }],
    ['FAILED', 200, { status: 'FAILED' }, { state: 'failed', bridgeStatus: 'failed' }],
    [
      'DONE + REFUNDED',
      200,
      { status: 'DONE', substatus: 'REFUNDED', receiving: { txHash: '0xback' } },
      { state: 'failed', bridgeStatus: 'refunded', destinationTxHash: '0xback' },
    ],
  ])('%s', async (_label, status, body, expected) => {
    expect(await check(status, body)).toEqual(expected);
  });

  it('DONE + COMPLETED: jumlah diterima kalau tokennya cocok', async () => {
    const mint = token('usdc-solana').contractAddress!;
    expect(
      await check(200, {
        status: 'DONE',
        substatus: 'COMPLETED',
        receiving: { txHash: 'sigTujuan', amount: '96127842', token: { address: mint } },
      }),
    ).toEqual({
      state: 'success',
      bridgeStatus: 'done',
      destinationTxHash: 'sigTujuan',
      receivedAmountRaw: 96_127_842n,
    });

    // PARTIAL (token lain) → selesai, tapi jumlahnya tidak dicatat sebagai token tujuan.
    const partial = await check(200, {
      status: 'DONE',
      substatus: 'PARTIAL',
      receiving: { txHash: 'x', amount: '5', token: { address: 'TokenLain' } },
    });
    expect(partial).toMatchObject({ state: 'success', receivedAmountRaw: undefined });
  });

  it('error lain dilempar', async () => {
    await expect(check(500, {})).rejects.toThrow('lifi_status_500');
  });
});

describe('jumlah diterima dari saldo token Solana', () => {
  const MINT = 'MintTujuan';
  const bal = (owner: string, mint: string, amount: string) => ({
    owner,
    mint,
    uiTokenAmount: { amount },
  });

  it('selisih saldo token tujuan milik pembayar', () => {
    expect(
      receivedFromBalances(
        'payer',
        MINT,
        [bal('payer', MINT, '10'), bal('pool', MINT, '999')],
        [bal('payer', MINT, '60'), bal('pool', MINT, '949')],
      ),
    ).toBe(50n);
    // Akun token baru (belum ada di pre).
    expect(receivedFromBalances('payer', MINT, [], [bal('payer', MINT, '7')])).toBe(7n);
    expect(receivedFromBalances('payer', MINT, [], [bal('lain', MINT, '7')])).toBeUndefined();
  });
});

function statusApp(chain: () => Promise<ChainTxStatus>, progress: () => Promise<SwapProgress>) {
  const db = seededDb();
  const clock = { now: TEST_NOW };
  const store = new TransactionStore(db, () => clock.now);
  const progressCheck = vi.fn(progress);
  const app = createApp({
    ...makeDeps(db, {}, { now: () => clock.now }),
    priceStaleAfterMs: 60_000,
    logRequests: false,
    transactions: {
      broadcasters: new Map(),
      transactionStore: store,
      walletKey,
      statusCheckers: new Map([
        ['arbitrum', { check: vi.fn(chain) }],
        ['solana', { check: vi.fn(chain) }],
      ]),
      swapProgress: createSwapProgressChecker({ lifi: progressCheck, jupiter: progressCheck }),
    },
  });
  const get = async (path: string) => {
    const res = await app.request(path);
    return { res, body: (await res.json()) as Record<string, any> };
  };
  return { store, get, clock, progressCheck };
}

describe('GET /v1/swap/:id', () => {
  it('swap satu jaringan: transaksi sukses → success + jumlah diterima', async () => {
    const { store, get } = statusApp(
      async () => ({ state: 'success', feeRaw: 9n }),
      async () => ({ state: 'success', receivedAmountRaw: 99_800_000n }),
    );
    const { transaction } = store.insertSwapPending(swapInput());
    const { res, body } = await get(`/v1/swap/${transaction.id}`);
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      isFinal: true,
      transaction: {
        status: 'success',
        feeRaw: '9',
        swap: { receivedAmount: '99.8', bridgeStatus: null },
      },
    });
  });

  it('bridge: asal sukses tapi bridge jalan → tetap pending, lalu selesai saat koin sampai', async () => {
    const results: SwapProgress[] = [
      { state: 'pending', bridgeStatus: 'pending' },
      {
        state: 'success',
        bridgeStatus: 'done',
        destinationTxHash: 'sigTujuan',
        receivedAmountRaw: 96_000_000n,
      },
    ];
    const { store, get, clock } = statusApp(
      async () => ({ state: 'success', feeRaw: 9n }),
      async () => results.shift()!,
    );
    const { transaction } = store.insertSwapPending(
      swapInput({
        toNetworkId: 'solana',
        toTokenId: 'usdc-solana',
        quotedAmountRaw: 96_100_000n,
        minAmountRaw: 95_600_000n,
      }),
    );

    let { body } = await get(`/v1/swap/${transaction.id}`);
    expect(body).toMatchObject({
      isFinal: false,
      transaction: { status: 'pending', swap: { bridgeStatus: 'pending' } },
    });

    clock.now = new Date(TEST_NOW.getTime() + 6_000);
    ({ body } = await get(`/v1/swap/${transaction.id}`));
    expect(body).toMatchObject({
      isFinal: true,
      transaction: {
        status: 'success',
        swap: {
          bridgeStatus: 'done',
          receivedAmount: '96',
          destinationTxHash: 'sigTujuan',
          destinationExplorerUrl: 'https://solscan.io/tx/sigTujuan',
        },
      },
    });
  });

  it('bridge refunded → failed dengan status refunded', async () => {
    const { store, get } = statusApp(
      async () => ({ state: 'success' }),
      async () => ({ state: 'failed', bridgeStatus: 'refunded' }),
    );
    const { transaction } = store.insertSwapPending(
      swapInput({ toNetworkId: 'base', toTokenId: 'usdc-base' }),
    );
    const { body } = await get(`/v1/swap/${transaction.id}`);
    expect(body.transaction).toMatchObject({
      status: 'failed',
      swap: { bridgeStatus: 'refunded' },
    });
  });

  it('pemantau gagal pada swap satu jaringan → tetap success, checkFailed', async () => {
    const { store, get } = statusApp(
      async () => ({ state: 'success' }),
      async () => Promise.reject(new Error('429')),
    );
    const { transaction } = store.insertSwapPending(swapInput());
    const { body } = await get(`/v1/swap/${transaction.id}`);
    expect(body).toMatchObject({
      checkFailed: true,
      transaction: { status: 'success', swap: { receivedAmount: null } },
    });
  });

  it('kiriman biasa atau id asing → 404', async () => {
    const { store, get } = statusApp(
      async () => null,
      async () => ({ state: 'pending' }),
    );
    const { transaction } = store.insertPending({ ...swapInput(), type: 'send', txHash: '0xsend' });
    expect((await get(`/v1/swap/${transaction.id}`)).res.status).toBe(404);
    expect((await get('/v1/swap/bukan-id')).res.status).toBe(404);
  });
});

describe('GET /v1/swap/history', () => {
  function seeded() {
    const app = statusApp(
      async () => null,
      async () => ({ state: 'pending' }),
    );
    for (let i = 0; i < 3; i += 1) {
      app.clock.now = new Date(TEST_NOW.getTime() + i * 60_000);
      app.store.insertSwapPending(swapInput({ txHash: `0xevm${i}` }));
    }
    // Waktu berbeda supaya urutan pasti (waktu sama diurutkan pakai id acak).
    app.clock.now = new Date(TEST_NOW.getTime() + 3 * 60_000);
    app.store.insertSwapPending(
      swapInput({
        walletKey: walletKey(SOLANA_OWNER),
        networkId: 'solana',
        tokenId: 'usdc-solana',
        toNetworkId: 'solana',
        toTokenId: 'usdt-solana',
        provider: 'jupiter',
        txHash: 'sigSol',
      }),
    );
    app.store.insertPending({ ...swapInput(), type: 'send', txHash: '0xsend' });
    app.store.insertSwapPending(
      swapInput({
        walletKey: walletKey('0x2222222222222222222222222222222222222222'),
        txHash: '0xlain',
      }),
    );
    return app;
  }

  it('swap milik alamat EVM + Solana, terbaru dulu, tanpa kiriman & wallet lain', async () => {
    const { get } = seeded();
    const { res, body } = await get(
      `/v1/swap/history?evm=${EVM_OWNER.toLowerCase()}&solana=${SOLANA_OWNER}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body.swaps.map((swap: { txHash: string }) => swap.txHash)).toEqual([
      'sigSol',
      '0xevm2',
      '0xevm1',
      '0xevm0',
    ]);
    expect(body.swaps[0].swap).toMatchObject({ provider: 'jupiter', toSymbol: 'USDT' });
    expect(body.nextBefore).toBeNull();
  });

  it('paging dengan limit + before', async () => {
    const { get } = seeded();
    const first = await get(`/v1/swap/history?evm=${EVM_OWNER}&limit=2`);
    expect(first.body.swaps.map((swap: { txHash: string }) => swap.txHash)).toEqual([
      '0xevm2',
      '0xevm1',
    ]);
    const next = await get(
      `/v1/swap/history?evm=${EVM_OWNER}&limit=2&before=${encodeURIComponent(first.body.nextBefore)}`,
    );
    expect(next.body.swaps.map((swap: { txHash: string }) => swap.txHash)).toEqual(['0xevm0']);
    expect(next.body.nextBefore).toBeNull();
  });

  it.each([
    ['', 'missing_address'],
    ['evm=0x12', 'invalid_evm_address'],
    ['solana=0OIl', 'invalid_solana_address'],
    [`evm=${EVM_OWNER}&before=sembarang`, 'invalid_cursor'],
  ])('menolak %s', async (query, error) => {
    const { get } = seeded();
    const { res, body } = await get(`/v1/swap/history?${query}`);
    expect(res.status).toBe(400);
    expect(body.error).toBe(error);
  });
});
