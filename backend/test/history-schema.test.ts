import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { runMigrations } from '../src/db/database.js';
import { MIGRATIONS } from '../src/db/migrations.js';
import { TransactionStore, type ImportedTransaction } from '../src/transactions/store.js';

import { seededDb, TEST_NOW } from './helpers.js';

const incoming = (overrides: Partial<ImportedTransaction> = {}): ImportedTransaction => ({
  walletKey: 'k1',
  networkId: 'arbitrum',
  tokenId: 'usdc-arbitrum',
  type: 'receive',
  status: 'success',
  amountRaw: 500_000_000n,
  amountUsd: 500,
  counterpartyAddress: '0x5b7E0D3A9F1C4e2a6B8d0f1E3C5a7b9d1E3F5a7C',
  txHash: '0xin1',
  blockTime: '2026-09-28T03:10:00.000Z',
  ...overrides,
});

function store() {
  const db = seededDb();
  return { db, store: new TransactionStore(db, () => TEST_NOW) };
}

describe('riwayat dari blockchain', () => {
  it('uang masuk diimpor sebagai source=chain, final, waktu = waktu blok', () => {
    const { store: s } = store();
    expect(s.importFromChain([incoming()])).toBe(1);
    const tx = s.findByHash('k1', 'arbitrum', '0xin1')!;
    expect(tx).toMatchObject({
      type: 'receive',
      status: 'success',
      source: 'chain',
      blockTime: '2026-09-28T03:10:00.000Z',
      createdAt: '2026-09-28T03:10:00.000Z',
      updatedAt: TEST_NOW.toISOString(),
    });
  });

  it('impor ulang / hash yang sudah dicatat aplikasi tidak dobel dan tidak ditimpa', () => {
    const { db, store: s } = store();
    const { transaction: sent } = s.insertPending({
      walletKey: 'k1',
      networkId: 'arbitrum',
      tokenId: 'usdc-arbitrum',
      type: 'send',
      amountRaw: 1n,
      amountUsd: 1,
      counterpartyAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      txHash: '0xapp',
    });
    expect(sent).toMatchObject({ source: 'app', blockTime: null });

    expect(
      s.importFromChain([incoming(), incoming(), incoming({ txHash: '0xapp', type: 'receive' })]),
    ).toBe(1);
    expect(s.findById(sent.id)).toMatchObject({ type: 'send', source: 'app' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM transactions').get()).toEqual({ n: 2 });
  });

  it('transaksi aplikasi dapat waktu blok saat selesai', () => {
    const { store: s } = store();
    const { transaction } = s.insertPending({
      walletKey: 'k1',
      networkId: 'arbitrum',
      tokenId: 'usdc-arbitrum',
      type: 'send',
      amountRaw: 1n,
      amountUsd: 1,
      counterpartyAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      txHash: '0xapp',
    });
    s.setStatus(transaction.id, 'pending');
    expect(s.findById(transaction.id)?.blockTime).toBeNull();
    s.setStatus(transaction.id, 'success');
    expect(s.findById(transaction.id)?.blockTime).toBe(TEST_NOW.toISOString());
  });

  it('source di luar app/chain ditolak database', () => {
    const { db, store: s } = store();
    s.importFromChain([incoming()]);
    expect(() => db.prepare("UPDATE transactions SET source = 'manual'").run()).toThrow(/CHECK/);
  });
});

describe('posisi sinkron riwayat', () => {
  it('disimpan per wallet + jaringan, cursor kosong tidak menghapus yang lama', () => {
    const { store: s } = store();
    expect(s.getSyncCursor('k1', 'arbitrum')).toBeNull();
    s.setSyncCursor('k1', 'arbitrum', '250000000');
    s.setSyncCursor('k1', 'solana', 'sigTerakhir');
    s.setSyncCursor('k1', 'arbitrum', null);
    expect(s.getSyncCursor('k1', 'arbitrum')).toEqual({
      cursor: '250000000',
      syncedAt: TEST_NOW.toISOString(),
    });
    expect(s.getSyncCursor('k1', 'solana')?.cursor).toBe('sigTerakhir');
  });
});

describe('migrasi 7 di database lama', () => {
  it('baris transaksi lama otomatis source=app, block_time kosong', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations(
      db,
      MIGRATIONS.filter((migration) => migration.id < 7),
    );
    db.prepare(
      `INSERT INTO networks (id, name, chain_id, chain_type, native_symbol, explorer_url)
       VALUES ('arbitrum', 'Arbitrum', '42161', 'evm', 'ETH', 'https://arbiscan.io')`,
    ).run();
    db.prepare(
      `INSERT INTO tokens (id, symbol, name, network_id, contract_address, decimals)
       VALUES ('usdc-arbitrum', 'USDC', 'USD Coin', 'arbitrum', '0xaf88', 6)`,
    ).run();
    db.prepare(
      `INSERT INTO transactions (id, wallet_key, network_id, token_id, type, amount_raw,
         counterparty_address, tx_hash, created_at, updated_at)
       VALUES ('t1', 'k', 'arbitrum', 'usdc-arbitrum', 'send', '1', '0x1', '0xh', 'x', 'x')`,
    ).run();

    runMigrations(db);
    expect(db.prepare('SELECT source, block_time AS blockTime FROM transactions').get()).toEqual({
      source: 'app',
      blockTime: null,
    });
  });
});
