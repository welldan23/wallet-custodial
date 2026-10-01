import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { createWalletKey } from '../src/lib/wallet-key.js';
import { SOLANA_EXPIRY_MS, STUCK_AFTER_MS } from '../src/routes/transactions.js';
import {
  evmStatusCheckerFromClient,
  solanaStatusCheckerFromRpc,
  type ChainTxStatus,
  type TransactionStatusChecker,
} from '../src/transactions/status.js';
import { TransactionStore } from '../src/transactions/store.js';

import { makeDeps, seededDb, TEST_NOW } from './helpers.js';

const notFound = () =>
  Object.assign(new Error('not found'), { name: 'TransactionReceiptNotFoundError' });

describe('pengecek status EVM', () => {
  it('receipt sukses → success dengan biaya asli (+ biaya L1 kalau ada)', async () => {
    const checker = evmStatusCheckerFromClient({
      getTransactionReceipt: async () => ({
        status: 'success',
        gasUsed: 50_000n,
        effectiveGasPrice: 10n,
        l1Fee: 7n,
      }),
    });
    expect(await checker.check('0x01')).toEqual({ state: 'success', feeRaw: 500_007n });
  });

  it('receipt revert → failed; belum ada receipt → null; error lain dilempar', async () => {
    const reverted = evmStatusCheckerFromClient({
      getTransactionReceipt: async () => ({
        status: 'reverted',
        gasUsed: 1n,
        effectiveGasPrice: 2n,
      }),
    });
    expect(await reverted.check('0x01')).toEqual({ state: 'failed', feeRaw: 2n });

    const missing = evmStatusCheckerFromClient({
      getTransactionReceipt: async () => Promise.reject(notFound()),
    });
    expect(await missing.check('0x01')).toBeNull();

    const down = evmStatusCheckerFromClient({
      getTransactionReceipt: async () => Promise.reject(new Error('fetch failed')),
    });
    await expect(down.check('0x01')).rejects.toThrow('fetch failed');
  });
});

describe('pengecek status Solana', () => {
  const cases: [string, { confirmationStatus: string; failed: boolean } | null, ChainTxStatus][] = [
    [
      'processed → pending',
      { confirmationStatus: 'processed', failed: false },
      { state: 'pending' },
    ],
    [
      'confirmed → success',
      { confirmationStatus: 'confirmed', failed: false },
      { state: 'success', feeRaw: 5_000n },
    ],
    [
      'finalized + error → failed',
      { confirmationStatus: 'finalized', failed: true },
      { state: 'failed', feeRaw: 5_000n },
    ],
    ['tidak dikenal → null', null, null],
  ];
  for (const [label, status, expected] of cases) {
    it(label, async () => {
      const checker = solanaStatusCheckerFromRpc({
        signatureStatus: async () => status,
        transactionFee: async () => 5_000n,
      });
      expect(await checker.check('sig')).toEqual(expected);
    });
  }

  it('biaya gagal dibaca tidak menggagalkan status', async () => {
    const checker = solanaStatusCheckerFromRpc({
      signatureStatus: async () => ({ confirmationStatus: 'confirmed', failed: false }),
      transactionFee: async () => Promise.reject(new Error('429')),
    });
    expect(await checker.check('sig')).toEqual({ state: 'success', feeRaw: undefined });
  });
});

function statusApp(
  checks: Record<string, () => Promise<ChainTxStatus>>,
  clock = { now: TEST_NOW },
) {
  const db = seededDb();
  const store = new TransactionStore(db, () => clock.now);
  const checkers = new Map<string, TransactionStatusChecker & { check: ReturnType<typeof vi.fn> }>(
    Object.entries(checks).map(([id, fn]) => [id, { check: vi.fn(fn) }]),
  );
  const app = createApp({
    ...makeDeps(db, {}, { now: () => clock.now }),
    priceStaleAfterMs: 15 * 60_000,
    logRequests: false,
    transactions: {
      broadcasters: new Map(),
      transactionStore: store,
      walletKey: createWalletKey('tes'),
      statusCheckers: checkers,
    },
  });
  const insert = (networkId: string, tokenId: string) =>
    store.insertPending({
      walletKey: 'k',
      networkId,
      tokenId,
      type: 'send',
      amountRaw: 1_000_000n,
      amountUsd: 1,
      counterpartyAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      txHash: `hash-${networkId}`,
    }).transaction;
  const get = async (id: string) => {
    const res = await app.request(`/v1/transactions/${id}`);
    return { res, body: (await res.json()) as Record<string, any> };
  };
  return { checkers, insert, get, clock };
}

describe('GET /v1/transactions/:id', () => {
  it('pending → cek blockchain → success, biaya asli disimpan', async () => {
    const { insert, get } = statusApp({
      arbitrum: async () => ({ state: 'success', feeRaw: 1_234n }),
    });
    const tx = insert('arbitrum', 'usdc-arbitrum');
    const { res, body } = await get(tx.id);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      transaction: { id: tx.id, status: 'success', feeRaw: '1234' },
      isFinal: true,
      isStuck: false,
      checkFailed: false,
    });
  });

  it('RPC dicek paling sering tiap 5 detik; transaksi final tidak dicek lagi', async () => {
    const clock = { now: TEST_NOW };
    const { insert, get, checkers } = statusApp({ arbitrum: async () => null }, clock);
    const tx = insert('arbitrum', 'usdc-arbitrum');
    await get(tx.id);
    await get(tx.id);
    expect(checkers.get('arbitrum')!.check).toHaveBeenCalledTimes(1);

    clock.now = new Date(TEST_NOW.getTime() + 5_000);
    checkers.get('arbitrum')!.check.mockResolvedValueOnce({ state: 'failed', feeRaw: 9n });
    expect((await get(tx.id)).body.transaction.status).toBe('failed');

    clock.now = new Date(TEST_NOW.getTime() + 60_000);
    await get(tx.id);
    expect(checkers.get('arbitrum')!.check).toHaveBeenCalledTimes(2);
  });

  it('Solana yang tidak pernah terlihat setelah blockhash kedaluwarsa → failed', async () => {
    const clock = { now: TEST_NOW };
    const { insert, get } = statusApp({ solana: async () => null }, clock);
    const tx = insert('solana', 'usdc-solana');
    expect((await get(tx.id)).body.transaction.status).toBe('pending');

    clock.now = new Date(TEST_NOW.getTime() + SOLANA_EXPIRY_MS + 1);
    expect((await get(tx.id)).body).toMatchObject({
      transaction: { status: 'failed' },
      isFinal: true,
    });
  });

  it('EVM pending lama ditandai tertahan, bukan gagal', async () => {
    const clock = { now: TEST_NOW };
    const { insert, get } = statusApp({ arbitrum: async () => null }, clock);
    const tx = insert('arbitrum', 'usdc-arbitrum');
    clock.now = new Date(TEST_NOW.getTime() + STUCK_AFTER_MS + 1);
    expect((await get(tx.id)).body).toMatchObject({
      transaction: { status: 'pending' },
      isFinal: false,
      isStuck: true,
    });
  });

  it('RPC gagal → status lama + checkFailed, tanpa 500', async () => {
    const { insert, get } = statusApp({ arbitrum: async () => Promise.reject(new Error('down')) });
    const tx = insert('arbitrum', 'usdc-arbitrum');
    const { res, body } = await get(tx.id);
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ transaction: { status: 'pending' }, checkFailed: true });
  });

  it('id tidak ada / bukan UUID → 404', async () => {
    const { get } = statusApp({});
    expect((await get('00000000-0000-4000-8000-000000000000')).res.status).toBe(404);
    expect((await get('bukan-id')).res.status).toBe(404);
  });
});
