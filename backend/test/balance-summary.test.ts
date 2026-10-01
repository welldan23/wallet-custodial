import { describe, expect, it } from 'vitest';

import { getBalanceSummary } from '../src/services/balance-summary.js';

import {
  EVM_OWNER,
  failingReader,
  fakeReader,
  hangingReader,
  makeBalanceCache,
  makeDeps,
  seededDb,
  SOLANA_OWNER,
  TEST_NOW,
} from './helpers.js';

const owners = { evm: EVM_OWNER, solana: SOLANA_OWNER };

describe('getBalanceSummary', () => {
  it('menggabungkan saldo semua jaringan lengkap dengan nilai USD dan kurs', async () => {
    const db = seededDb();
    const deps = makeDeps(db, {
      ethereum: fakeReader({ 'usdc-ethereum': 180_000_000n, 'eth-ethereum': 600_000_000_000_000n })
        .reader,
      arbitrum: fakeReader({ 'usdc-arbitrum': 520_000_000n, 'usdt-arbitrum': 120_000_000n }).reader,
      base: fakeReader({}).reader,
      polygon: fakeReader({ 'usdt-polygon': 130_000_000n }).reader,
      solana: fakeReader({ 'usdc-solana': 100_000_000n, 'sol-solana': 215_000_000n }).reader,
    });

    const summary = await getBalanceSummary(deps, owners);
    const byId = new Map(summary.balances.map((item) => [item.tokenId, item]));

    expect(byId.get('usdc-ethereum')).toMatchObject({
      amount: '180',
      raw: '180000000',
      valueUsd: 180,
    });
    expect(byId.get('eth-ethereum')).toMatchObject({
      amount: '0.0006',
      isNative: true,
      valueUsd: 1.7883,
    });
    expect(byId.get('sol-solana')).toMatchObject({
      amount: '0.215',
      decimals: 9,
      valueUsd: 32.7445,
    });
    // Saldo nol tetap dikirim (perlu untuk status "gas kosong" di aplikasi).
    expect(byId.get('pol-polygon')).toMatchObject({ amount: '0', valueUsd: 0 });
    // Token tersembunyi tidak ikut.
    expect(byId.has('dai-ethereum')).toBe(false);

    expect(summary.totalUsd).toBeCloseTo(180 + 1.7883 + 520 + 120 + 130 + 100 + 32.7445, 6);
    expect(summary.fx).toEqual({ USD: 1, IDR: 16350 });
    expect(summary.pricesUpdatedAt).toBe('2026-10-01T10:42:00.000Z');
    expect(summary.isPartial).toBe(false);
    expect(summary.networks.map((network) => [network.networkId, network.status])).toEqual([
      ['ethereum', 'ok'],
      ['arbitrum', 'ok'],
      ['base', 'ok'],
      ['polygon', 'ok'],
      ['solana', 'ok'],
    ]);
  });

  it('tidak membaca token tersembunyi dari RPC', async () => {
    const db = seededDb();
    const ethereum = fakeReader({});
    await getBalanceSummary(makeDeps(db, { ethereum: ethereum.reader }), {
      evm: EVM_OWNER,
      solana: null,
    });
    expect(ethereum.calls[0]?.map((token) => token.id)).toEqual([
      'usdc-ethereum',
      'usdt-ethereum',
      'eth-ethereum',
    ]);
  });

  it('melewati jaringan Solana kalau alamat Solana tidak dikirim', async () => {
    const db = seededDb();
    const solana = fakeReader({});
    const summary = await getBalanceSummary(
      makeDeps(db, { ethereum: fakeReader({}).reader, solana: solana.reader }),
      { evm: EVM_OWNER, solana: null },
    );
    expect(summary.networks.find((network) => network.networkId === 'solana')?.status).toBe(
      'skipped',
    );
    expect(solana.calls).toHaveLength(0);
    // Jaringan EVM tanpa pembaca dilaporkan, bukan diam-diam hilang.
    expect(summary.networks.find((network) => network.networkId === 'base')?.status).toBe(
      'unsupported',
    );
    expect(summary.isPartial).toBe(true);
  });

  it('jaringan yang gagal atau timeout tidak menggagalkan jawaban', async () => {
    const db = seededDb();
    const summary = await getBalanceSummary(
      makeDeps(
        db,
        {
          ethereum: fakeReader({ 'usdc-ethereum': 5_000_000n }).reader,
          arbitrum: failingReader(),
          solana: hangingReader(),
        },
        { rpcTimeoutMs: 50 },
      ),
      owners,
    );

    expect(summary.isPartial).toBe(true);
    expect(summary.totalUsd).toBe(5);
    const status = Object.fromEntries(
      summary.networks.map((network) => [network.networkId, [network.status, network.error]]),
    );
    expect(status.ethereum).toEqual(['ok', undefined]);
    expect(status.arbitrum).toEqual(['error', 'rpc_error']);
    expect(status.solana).toEqual(['error', 'rpc_timeout']);
  });

  it('memakai cache per jaringan + alamat selama masih berlaku', async () => {
    const db = seededDb();
    const ethereum = fakeReader({ 'usdc-ethereum': 1_000_000n });
    const deps = makeDeps(db, { ethereum: ethereum.reader });

    await getBalanceSummary(deps, { evm: EVM_OWNER, solana: null });
    await getBalanceSummary(deps, { evm: EVM_OWNER, solana: null });
    expect(ethereum.calls).toHaveLength(1);

    await getBalanceSummary(deps, {
      evm: '0x2222222222222222222222222222222222222222',
      solana: null,
    });
    expect(ethereum.calls).toHaveLength(2);
  });
});

describe('getBalanceSummary + cache SQLite', () => {
  it('memakai saldo terakhir (stale) saat RPC gagal, lengkap dengan waktunya', async () => {
    const db = seededDb();
    let now = TEST_NOW;
    const balanceCache = makeBalanceCache(db, { now: () => now });
    const otherEvm = {
      arbitrum: fakeReader({}).reader,
      base: fakeReader({}).reader,
      polygon: fakeReader({}).reader,
    };

    const first = await getBalanceSummary(
      makeDeps(
        db,
        { ethereum: fakeReader({ 'usdc-ethereum': 42_000_000n }).reader, ...otherEvm },
        { balanceCache },
      ),
      { evm: EVM_OWNER, solana: null },
    );
    expect(first.networks[0]).toMatchObject({ status: 'ok', fetchedAt: TEST_NOW.toISOString() });

    now = new Date(TEST_NOW.getTime() + 60 * 60_000); // 1 jam kemudian, cache sudah tidak segar
    const second = await getBalanceSummary(
      makeDeps(db, { ethereum: failingReader(), ...otherEvm }, { balanceCache }),
      { evm: EVM_OWNER, solana: null },
    );

    expect(second.networks[0]).toEqual({
      networkId: 'ethereum',
      status: 'stale',
      totalUsd: 42,
      fetchedAt: TEST_NOW.toISOString(),
      error: 'rpc_error',
    });
    expect(second.totalUsd).toBe(42);
    expect(second.isStale).toBe(true);
    expect(second.isPartial).toBe(false);
  });

  it('saldo yang terlalu lama tidak dipakai lagi → error', async () => {
    const db = seededDb();
    let now = TEST_NOW;
    const balanceCache = makeBalanceCache(db, { now: () => now, maxStaleMs: 60 * 60_000 });

    await getBalanceSummary(
      makeDeps(db, { ethereum: fakeReader({ 'usdc-ethereum': 1n }).reader }, { balanceCache }),
      { evm: EVM_OWNER, solana: null },
    );
    now = new Date(TEST_NOW.getTime() + 2 * 60 * 60_000);
    const summary = await getBalanceSummary(
      makeDeps(db, { ethereum: failingReader() }, { balanceCache }),
      { evm: EVM_OWNER, solana: null },
    );

    expect(summary.networks[0]).toMatchObject({ status: 'error', fetchedAt: null });
    expect(summary.isPartial).toBe(true);
  });
});
