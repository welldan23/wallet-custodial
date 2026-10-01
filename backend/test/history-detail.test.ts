import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { ContactStore } from '../src/contacts/store.js';
import { createWalletKey } from '../src/lib/wallet-key.js';
import type { ChainTxStatus } from '../src/transactions/status.js';
import { TransactionStore } from '../src/transactions/store.js';

import { makeDeps, seededDb, TEST_NOW } from './helpers.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const FRIEND = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const TOKEN = 'b3f1c0de-7a9e-4c11-9d2a-5e6f7a8b9c0d';
const walletKey = createWalletKey('tes');

function detailApp(chain: () => Promise<ChainTxStatus> = async () => null) {
  const db = seededDb(); // ETH = 2980.5
  const store = new TransactionStore(db, () => TEST_NOW);
  const contacts = new ContactStore(db, () => TEST_NOW);
  const userId = contacts.ensureUserId(TOKEN);
  contacts.add(userId, {
    name: 'Vitalik',
    address: FRIEND.toLowerCase(),
    chainType: 'evm',
    networkId: null,
  });
  const app = createApp({
    ...makeDeps(db, {}),
    priceStaleAfterMs: 60_000,
    logRequests: false,
    contactStore: contacts,
    transactions: {
      broadcasters: new Map(),
      transactionStore: store,
      walletKey,
      statusCheckers: new Map([['arbitrum', { check: vi.fn(chain) }]]),
    },
  });
  const send = store.insertPending({
    walletKey: walletKey(OWNER),
    networkId: 'arbitrum',
    tokenId: 'usdc-arbitrum',
    type: 'send',
    amountRaw: 12_500_000n,
    amountUsd: 12.5,
    counterpartyAddress: FRIEND,
    txHash: '0xkirim',
  }).transaction;
  const get = async (id: string, token?: string) => {
    const res = await app.request(`/v1/history/${id}`, {
      headers: token ? { Authorization: `Device ${token}` } : {},
    });
    return { res, body: (await res.json()) as Record<string, any> };
  };
  return { get, send, store };
}

describe('GET /v1/history/:id', () => {
  it('detail lengkap: status terbaru, jaringan, token, biaya dalam ETH & USD', async () => {
    const { get, send } = detailApp(async () => ({ state: 'success', feeRaw: 1_340_000_000_000n }));
    const { res, body } = await get(send.id);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      isFinal: true,
      transaction: {
        id: send.id,
        type: 'send',
        status: 'success',
        amount: '12.5',
        counterpartyAddress: FRIEND,
      },
      network: {
        id: 'arbitrum',
        name: 'Arbitrum',
        nativeSymbol: 'ETH',
        explorerUrl: 'https://arbiscan.io',
      },
      token: { tokenId: 'usdc-arbitrum', symbol: 'USDC', decimals: 6 },
      fee: { amount: '0.00000134', symbol: 'ETH', usd: 0.003994 },
      counterpartyContact: null,
    });
  });

  it('nama kontak hanya dengan token perangkat pemiliknya', async () => {
    const { get, send } = detailApp();
    expect((await get(send.id, TOKEN)).body.counterpartyContact).toBe('Vitalik');
    expect(
      (await get(send.id, 'Zx9_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).body.counterpartyContact,
    ).toBeNull();
  });

  it('biaya belum diketahui → fee null; id asing → 404', async () => {
    const { get, send } = detailApp();
    expect((await get(send.id)).body).toMatchObject({ fee: null, isFinal: false });
    expect((await get('00000000-0000-4000-8000-000000000000')).res.status).toBe(404);
    expect((await get('bukan-id')).res.status).toBe(404);
  });

  it('transaksi masuk hasil impor juga bisa dibuka', async () => {
    const { get, store } = detailApp();
    store.importFromChain([
      {
        walletKey: walletKey(OWNER),
        networkId: 'arbitrum',
        tokenId: 'usdc-arbitrum',
        type: 'receive',
        status: 'success',
        amountRaw: 500_000_000n,
        amountUsd: 500,
        counterpartyAddress: FRIEND,
        txHash: '0xmasuk',
        blockTime: '2026-09-30T18:00:00.000Z',
      },
    ]);
    const incoming = store.findByHash(walletKey(OWNER), 'arbitrum', '0xmasuk')!;
    const { body } = await get(incoming.id, TOKEN);
    expect(body).toMatchObject({
      isFinal: true,
      transaction: { type: 'receive', source: 'chain', amount: '500' },
      counterpartyContact: 'Vitalik',
    });
  });
});
