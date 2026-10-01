import { describe, expect, it } from 'vitest';

import { MIGRATIONS } from '../src/db/migrations.js';
import { TransactionStore, type NewSwap } from '../src/transactions/store.js';

import { seededDb, TEST_NOW } from './helpers.js';

const LIFI_ROUTER = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';

const swap = (overrides: Partial<NewSwap> = {}): NewSwap => ({
  walletKey: 'k1',
  networkId: 'arbitrum',
  tokenId: 'usdc-arbitrum',
  amountRaw: 100_000_000n,
  amountUsd: 100,
  counterpartyAddress: LIFI_ROUTER,
  txHash: '0xabc',
  provider: 'lifi',
  toNetworkId: 'arbitrum',
  toTokenId: 'usdt-arbitrum',
  quotedAmountRaw: 99_940_000n,
  minAmountRaw: 99_440_300n,
  slippageBps: 50,
  ...overrides,
});

function store() {
  const db = seededDb();
  return { db, store: new TransactionStore(db, () => TEST_NOW) };
}

describe('tabel swap_details', () => {
  it('swap tercatat sebagai transactions bertipe swap + detail', () => {
    const { store: s } = store();
    const { transaction, created } = s.insertSwapPending(swap({ quoteId: 'q-1' }));
    expect(created).toBe(true);
    expect(transaction).toMatchObject({
      type: 'swap',
      status: 'pending',
      tokenId: 'usdc-arbitrum',
      amountRaw: '100000000',
      counterpartyAddress: LIFI_ROUTER,
      swap: {
        transactionId: transaction.id,
        provider: 'lifi',
        toTokenId: 'usdt-arbitrum',
        quotedAmountRaw: '99940000',
        minAmountRaw: '99440300',
        receivedAmountRaw: null,
        slippageBps: 50,
        bridgeStatus: null,
        quoteId: 'q-1',
      },
    });
  });

  it('swap beda jaringan mulai dengan status bridge pending, lalu hasil akhir dicatat', () => {
    const { store: s } = store();
    const { transaction } = s.insertSwapPending(
      swap({ toNetworkId: 'solana', toTokenId: 'usdc-solana', quotedAmountRaw: 99_600_000n }),
    );
    expect(transaction.swap.bridgeStatus).toBe('pending');

    s.setSwapResult(transaction.id, {
      receivedAmountRaw: 99_610_000n,
      bridgeStatus: 'done',
      destinationTxHash: '5VERv8NMvz',
    });
    expect(s.findSwap(transaction.id)?.swap).toMatchObject({
      receivedAmountRaw: '99610000',
      bridgeStatus: 'done',
      destinationTxHash: '5VERv8NMvz',
    });
  });

  it('jumlah 18 desimal (di atas batas INTEGER SQLite) tersimpan utuh', () => {
    const { store: s } = store();
    const big = 25n * 10n ** 18n;
    const { transaction } = s.insertSwapPending(
      swap({
        networkId: 'ethereum',
        tokenId: 'eth-ethereum',
        toNetworkId: 'ethereum',
        toTokenId: 'usdc-ethereum',
        amountRaw: big,
        quotedAmountRaw: big,
        minAmountRaw: big - 1n,
      }),
    );
    expect(transaction.amountRaw).toBe(big.toString());
    expect(transaction.swap.minAmountRaw).toBe((big - 1n).toString());
  });

  it('hash yang sama tidak dobel; detail tetap satu', () => {
    const { db, store: s } = store();
    const first = s.insertSwapPending(swap());
    const second = s.insertSwapPending(swap({ quotedAmountRaw: 1n, minAmountRaw: 1n }));
    expect(second.created).toBe(false);
    expect(second.transaction.id).toBe(first.transaction.id);
    expect(second.transaction.swap.quotedAmountRaw).toBe('99940000');
    expect(db.prepare('SELECT COUNT(*) AS n FROM swap_details').get()).toEqual({ n: 1 });
  });

  it('menolak minimal di atas perkiraan dan jumlah tidak valid (tanpa baris setengah jadi)', () => {
    const { db, store: s } = store();
    expect(() => s.insertSwapPending(swap({ minAmountRaw: 99_940_001n }))).toThrow(
      'min_amount_above_quote',
    );
    expect(() => s.insertSwapPending(swap({ quotedAmountRaw: 0n, minAmountRaw: 0n }))).toThrow(
      'invalid_swap_amount',
    );
    expect(() => s.insertSwapPending(swap({ slippageBps: 0 }))).toThrow(/CHECK/);
    expect(() => s.insertSwapPending(swap({ toTokenId: 'usdc-tron' }))).toThrow(/FOREIGN KEY/);
    expect(db.prepare('SELECT COUNT(*) AS n FROM transactions').get()).toEqual({ n: 0 });
  });

  it('kolom tambahan provider/bridge dibatasi nilainya', () => {
    const { db, store: s } = store();
    const { transaction } = s.insertSwapPending(swap());
    expect(() =>
      db
        .prepare("UPDATE swap_details SET provider = '1inch' WHERE transaction_id = ?")
        .run(transaction.id),
    ).toThrow(/CHECK/);
    expect(() =>
      db
        .prepare("UPDATE swap_details SET bridge_status = 'lost' WHERE transaction_id = ?")
        .run(transaction.id),
    ).toThrow(/CHECK/);
    expect(() =>
      db
        .prepare("UPDATE swap_details SET received_amount_raw = '1.5' WHERE transaction_id = ?")
        .run(transaction.id),
    ).toThrow(/CHECK/);
  });

  it('kiriman biasa bukan swap; hapus transaksi ikut menghapus detail', () => {
    const { db, store: s } = store();
    const { transaction: send } = s.insertPending({ ...swap(), type: 'send', txHash: '0xsend' });
    expect(s.findSwap(send.id)).toBeNull();

    const { transaction } = s.insertSwapPending(swap());
    db.prepare('DELETE FROM transactions WHERE id = ?').run(transaction.id);
    expect(db.prepare('SELECT COUNT(*) AS n FROM swap_details').get()).toEqual({ n: 0 });
  });

  it('migrasi swap_details terdaftar setelah tabel transaksi', () => {
    const ids = MIGRATIONS.map((migration) => migration.name);
    expect(ids.indexOf('swap_details')).toBeGreaterThan(ids.indexOf('transactions'));
  });
});
