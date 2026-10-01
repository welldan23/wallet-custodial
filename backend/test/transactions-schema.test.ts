import { describe, expect, it } from 'vitest';

import type { Db } from '../src/db/database.js';

import { seededDb } from './helpers.js';

const NOW = '2026-10-01T10:00:00.000Z';
const HASH = '0x' + 'ab'.repeat(32);

function insert(db: Db, overrides: Record<string, unknown> = {}) {
  return db
    .prepare(
      `INSERT INTO transactions (id, wallet_key, network_id, token_id, type, status, amount_raw,
         amount_usd, fee_raw, counterparty_address, tx_hash, created_at, updated_at)
       VALUES (@id, @walletKey, @networkId, @tokenId, @type, @status, @amountRaw,
         @amountUsd, @feeRaw, @counterparty, @txHash, @createdAt, @updatedAt)`,
    )
    .run({
      id: 'tx-1',
      walletKey: 'k1',
      networkId: 'arbitrum',
      tokenId: 'usdc-arbitrum',
      type: 'send',
      status: 'pending',
      amountRaw: '12500000',
      amountUsd: 12.5,
      feeRaw: null,
      counterparty: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      txHash: HASH,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    });
}

describe('tabel transactions', () => {
  it('menyimpan kiriman dengan jumlah presisi penuh (teks)', () => {
    const db = seededDb();
    insert(db, { amountRaw: '123456789012345678901234567890' });
    const row = db.prepare('SELECT amount_raw, status FROM transactions').get();
    expect(row).toEqual({ amount_raw: '123456789012345678901234567890', status: 'pending' });
  });

  it.each([
    ['type tidak dikenal', { type: 'mint' }],
    ['status tidak dikenal', { status: 'done' }],
    ['jumlah bukan angka bulat', { amountRaw: '12.5' }],
    ['jumlah negatif', { amountRaw: '-1' }],
    ['jumlah kosong', { amountRaw: '' }],
    ['biaya bukan angka', { feeRaw: '1e9' }],
    ['jaringan tidak ada', { networkId: 'tron' }],
    ['token tidak ada', { tokenId: 'usdc-tron' }],
  ])('menolak %s', (_label, overrides) => {
    const db = seededDb();
    expect(() => insert(db, overrides)).toThrow();
  });

  it('hash sama untuk wallet + jaringan yang sama tidak boleh dobel', () => {
    const db = seededDb();
    insert(db);
    expect(() => insert(db, { id: 'tx-2' })).toThrow(/UNIQUE/);
    // Hash yang sama di jaringan lain atau milik wallet lain tetap boleh.
    insert(db, { id: 'tx-3', networkId: 'base', tokenId: 'usdc-base' });
    insert(db, { id: 'tx-4', walletKey: 'k2', type: 'receive' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM transactions').get()).toEqual({ n: 3 });
  });

  it('daftar per wallet memakai indeks wallet + waktu', () => {
    const db = seededDb();
    const plan = db
      .prepare(
        'EXPLAIN QUERY PLAN SELECT * FROM transactions WHERE wallet_key = ? ORDER BY created_at DESC',
      )
      .all('k1') as { detail: string }[];
    expect(plan.map((step) => step.detail).join(' ')).toContain('transactions_wallet_created');
  });
});
