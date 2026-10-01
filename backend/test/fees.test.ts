import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { MVP_TOKENS } from '../src/catalog/mvp.js';
import {
  DEFAULT_GAS_LIMIT,
  evmFeeEstimatorFromClient,
  ZERO_AMOUNT_BUFFER,
} from '../src/fees/evm.js';
import {
  associatedTokenAddress,
  BASE_FEE_PER_SIGNATURE,
  medianCeil,
  solanaFeeEstimatorFromRpc,
  type SolanaFeeRpc,
} from '../src/fees/solana.js';
import type { FeeEstimate, FeeEstimator, FeeRequest } from '../src/fees/types.js';

/** Bentuk JSON dicek per field di tiap tes. */
type FeeResponse = Record<string, any>;

import { makeDeps, seededDb, SOLANA_OWNER, TEST_NOW } from './helpers.js';

const token = (id: string) => MVP_TOKENS.find((item) => item.id === id)!;
const FROM = '0x1111111111111111111111111111111111111111';
const TO = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const GWEI = 1_000_000_000n;

function evmClient(overrides: Partial<Parameters<typeof evmFeeEstimatorFromClient>[0]> = {}) {
  return {
    estimateFeesPerGas: vi.fn(async () => ({ maxFeePerGas: 2n * GWEI })),
    estimateGas: vi.fn(async () => 50_000n),
    ...overrides,
  };
}

describe('estimasi biaya EVM', () => {
  it('memakai simulasi asli kalau pengirim + jumlah ada (margin 10%)', async () => {
    const client = evmClient();
    const fee = await evmFeeEstimatorFromClient(client).estimate({
      token: token('usdc-arbitrum'),
      from: FROM,
      to: TO,
      amountRaw: 10_000_000n,
    });
    expect(fee.method).toBe('simulated');
    expect(fee.gasLimit).toBe(55_000n);
    expect(fee.totalRaw).toBe(55_000n * 2n * GWEI);
    expect(client.estimateGas).toHaveBeenCalledTimes(1);
  });

  it('kalau simulasi asli gagal, pakai simulasi jumlah 0 + cadangan slot penerima', async () => {
    const client = evmClient({
      estimateGas: vi
        .fn()
        .mockRejectedValueOnce(new Error('transfer amount exceeds balance'))
        .mockResolvedValueOnce(30_000n),
    });
    const fee = await evmFeeEstimatorFromClient(client).estimate({
      token: token('usdc-ethereum'),
      from: FROM,
      amountRaw: 1n,
    });
    expect(fee.method).toBe('approximate');
    expect(fee.gasLimit).toBe(((30_000n + ZERO_AMOUNT_BUFFER) * 110n) / 100n);
  });

  it('koin gas tidak diberi cadangan slot; tanpa pengirim langsung kira-kira', async () => {
    const client = evmClient({ estimateGas: vi.fn(async () => 21_000n) });
    const fee = await evmFeeEstimatorFromClient(client).estimate({ token: token('eth-base') });
    expect(fee.method).toBe('approximate');
    expect(fee.gasLimit).toBe(23_100n);
  });

  it('semua simulasi gagal → angka gas umum', async () => {
    const client = evmClient({ estimateGas: vi.fn(async () => Promise.reject(new Error('x'))) });
    const fee = await evmFeeEstimatorFromClient(client).estimate({ token: token('usdt-polygon') });
    expect(fee).toMatchObject({ method: 'default', gasLimit: DEFAULT_GAS_LIMIT.erc20 });
  });

  it('jaringan OP-stack menambah biaya data L1 ke total', async () => {
    const client = evmClient({ estimateL1Fee: vi.fn(async () => 7_000n) });
    const fee = await evmFeeEstimatorFromClient(client).estimate({ token: token('usdc-base') });
    expect(fee.parts.map((part) => part.kind)).toEqual(['execution', 'l1_data']);
    expect(fee.totalRaw).toBe(fee.parts[0]!.raw + 7_000n);
  });

  it('gagal ambil harga gas = error (bukan angka nol)', async () => {
    const client = evmClient({
      estimateFeesPerGas: vi.fn(async () => Promise.reject(new Error('rpc'))),
    });
    await expect(
      evmFeeEstimatorFromClient(client).estimate({ token: token('usdc-arbitrum') }),
    ).rejects.toThrow('rpc');
  });
});

function solanaRpc(overrides: Partial<SolanaFeeRpc> = {}): SolanaFeeRpc {
  return {
    recentPriorityFees: vi.fn(async () => [0n, 0n, 100_000n, 300_000n, 0n]),
    accountExists: vi.fn(async () => true),
    rentExemptMinimum: vi.fn(async () => 2_039_280n),
    ...overrides,
  };
}

describe('estimasi biaya Solana', () => {
  it('median dibulatkan ke atas, nol untuk daftar kosong', () => {
    expect(medianCeil([])).toBe(0n);
    expect(medianCeil([5n, 1n, 3n])).toBe(3n);
    expect(medianCeil([1n, 2n])).toBe(2n);
  });

  it('biaya dasar + priority fee (median bukan nol dari akun mint × compute unit)', async () => {
    const rpc = solanaRpc();
    const fee = await solanaFeeEstimatorFromRpc(rpc).estimate({
      token: token('usdc-solana'),
      to: SOLANA_OWNER,
    });
    expect(rpc.recentPriorityFees).toHaveBeenCalledWith([token('usdc-solana').contractAddress]);
    // median bukan nol = 200_000 µlamport/CU × 40_000 CU = 8_000 lamport
    expect(fee.parts).toEqual([
      { kind: 'execution', raw: BASE_FEE_PER_SIGNATURE },
      { kind: 'priority', raw: 8_000n },
    ]);
    expect(fee.createsRecipientAccount).toBe(false);
  });

  it('penerima belum punya akun token → tambah sewa akun dari RPC', async () => {
    const rpc = solanaRpc({ accountExists: vi.fn(async () => false) });
    const fee = await solanaFeeEstimatorFromRpc(rpc).estimate({
      token: token('usdt-solana'),
      to: SOLANA_OWNER,
    });
    expect(fee.createsRecipientAccount).toBe(true);
    expect(fee.parts.at(-1)).toEqual({ kind: 'token_account_rent', raw: 2_039_280n });
    expect(rpc.accountExists).toHaveBeenCalledWith(
      await associatedTokenAddress(SOLANA_OWNER, token('usdt-solana').contractAddress!),
    );
  });

  it('kirim SOL tidak cek akun token dan tanpa penerima tetap jalan', async () => {
    const rpc = solanaRpc({ recentPriorityFees: vi.fn(async () => [0n, 0n]) });
    const fee = await solanaFeeEstimatorFromRpc(rpc).estimate({ token: token('sol-solana') });
    expect(fee.totalRaw).toBe(BASE_FEE_PER_SIGNATURE);
    expect(rpc.accountExists).not.toHaveBeenCalled();
  });

  it('alamat akun token (ATA) deterministik dan beda per mint', async () => {
    const usdc = await associatedTokenAddress(SOLANA_OWNER, token('usdc-solana').contractAddress!);
    expect(usdc).toBe(
      await associatedTokenAddress(SOLANA_OWNER, token('usdc-solana').contractAddress!),
    );
    expect(usdc).not.toBe(
      await associatedTokenAddress(SOLANA_OWNER, token('usdt-solana').contractAddress!),
    );
  });
});

function fakeEstimator(result: Partial<FeeEstimate> = {}) {
  const estimate = vi.fn(async (_request: FeeRequest): Promise<FeeEstimate> => ({
    totalRaw: 1_340_000_000_000n, // 0.00000134 ETH
    parts: [{ kind: 'execution', raw: 1_340_000_000_000n }],
    method: 'approximate',
    gasLimit: 67_000n,
    maxFeePerGas: 20_000_000n,
    ...result,
  }));
  return { estimator: { estimate } satisfies FeeEstimator, estimate };
}

function feeApp(estimators: Record<string, FeeEstimator>) {
  return createApp({
    ...makeDeps(seededDb(), {}),
    feeEstimators: new Map(Object.entries(estimators)),
    priceStaleAfterMs: 15 * 60_000,
    logRequests: false,
  });
}

describe('GET /v1/fees', () => {
  it('mengembalikan biaya dalam koin gas, USD, Rupiah, plus metadata jaringan', async () => {
    const { estimator } = fakeEstimator();
    const res = await feeApp({ arbitrum: estimator }).request(
      '/v1/fees?network=arbitrum&token=usdc-arbitrum',
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=15');
    const body = (await res.json()) as FeeResponse;
    expect(body.network).toMatchObject({
      id: 'arbitrum',
      chainId: '42161',
      nativeSymbol: 'ETH',
      nativeDecimals: 18,
      explorerTxUrl: 'https://arbiscan.io/tx/{hash}',
    });
    expect(body.token).toEqual({
      tokenId: 'usdc-arbitrum',
      symbol: 'USDC',
      decimals: 6,
      isNative: false,
    });
    expect(body.fee).toMatchObject({
      raw: '1340000000000',
      amount: '0.00000134',
      usd: 0.003994, // 0.00000134 × 2980.5
      idr: 65,
      method: 'approximate',
      gasLimit: '67000',
    });
    expect(body.nativeUsdPrice).toBe(2980.5);
    expect(body.estimatedAt).toBe(TEST_NOW.toISOString());
  });

  it('meneruskan alamat (dinormalisasi) + jumlah satuan terkecil, tanpa cache', async () => {
    const { estimator, estimate } = fakeEstimator();
    const app = feeApp({ arbitrum: estimator });
    const query = `network=arbitrum&token=usdc-arbitrum&from=${FROM}&to=${TO.toLowerCase()}&amount=12.5`;
    const res = await app.request(`/v1/fees?${query}`);
    expect(res.headers.get('cache-control')).toBe('no-store');
    await app.request(`/v1/fees?${query}`);
    expect(estimate).toHaveBeenCalledTimes(2);
    expect(estimate.mock.calls[0]?.[0]).toMatchObject({
      from: FROM,
      to: TO,
      amountRaw: 12_500_000n,
    });
  });

  it('jawaban tanpa alamat disimpan sebentar di memori', async () => {
    const { estimator, estimate } = fakeEstimator();
    const app = feeApp({ arbitrum: estimator });
    await app.request('/v1/fees?network=arbitrum&token=usdc-arbitrum');
    await app.request('/v1/fees?network=arbitrum&token=usdc-arbitrum');
    expect(estimate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['network=tron&token=usdt-tron', 'unknown_network'],
    ['network=arbitrum&token=usdc-base', 'unknown_token'],
    ['network=ethereum&token=dai-ethereum', 'unknown_token'],
    ['network=arbitrum&token=usdc-arbitrum&from=0x123', 'invalid_from'],
    [`network=arbitrum&token=usdc-arbitrum&to=${SOLANA_OWNER}`, 'invalid_to'],
    ['network=arbitrum&token=usdc-arbitrum&amount=1.2345678', 'invalid_amount'],
    ['network=arbitrum&token=usdc-arbitrum&amount=-1', 'invalid_amount'],
    ['network=arbitrum&token=usdc-arbitrum&amount=1e5', 'invalid_amount'],
  ])('menolak %s', async (query, error) => {
    const res = await feeApp({ arbitrum: fakeEstimator().estimator }).request(`/v1/fees?${query}`);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error });
  });

  it('503 kalau jaringan belum punya RPC, 502 kalau RPC gagal', async () => {
    const missing = await feeApp({}).request('/v1/fees?network=base&token=usdc-base');
    expect(missing.status).toBe(503);

    const failing = { estimate: () => Promise.reject(new Error('https://rpc.secret/key')) };
    const res = await feeApp({ base: failing }).request('/v1/fees?network=base&token=usdc-base');
    expect(res.status).toBe(502);
    const body = (await res.json()) as FeeResponse;
    expect(body).toMatchObject({ error: 'rpc_error' });
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('Solana: penanda akun token baru ikut di jawaban', async () => {
    const { estimator } = fakeEstimator({
      totalRaw: 2_044_280n,
      parts: [
        { kind: 'execution', raw: 5_000n },
        { kind: 'token_account_rent', raw: 2_039_280n },
      ],
      method: 'simulated',
      gasLimit: undefined,
      maxFeePerGas: undefined,
      createsRecipientAccount: true,
    });
    const res = await feeApp({ solana: estimator }).request(
      `/v1/fees?network=solana&token=usdc-solana&to=${SOLANA_OWNER}`,
    );
    const body = (await res.json()) as FeeResponse;
    expect(body.network.nativeDecimals).toBe(9);
    expect(body.fee).toMatchObject({
      amount: '0.00204428',
      createsRecipientAccount: true,
      gasLimit: null,
    });
    expect(body.fee.parts[1]).toEqual({
      kind: 'token_account_rent',
      raw: '2039280',
      amount: '0.00203928',
    });
  });
});
