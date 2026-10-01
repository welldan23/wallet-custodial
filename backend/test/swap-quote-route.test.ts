import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { QUOTE_TTL_MS } from '../src/routes/swap.js';
import { checkSlippage } from '../src/swap/slippage.js';
import { SwapQuoteError, type SwapQuote, type SwapQuoteRequest } from '../src/swap/types.js';

import { makeDeps, seededDb, SOLANA_OWNER, TEST_NOW } from './helpers.js';

const quoteFor = (request: SwapQuoteRequest, out = 99_770_030n): SwapQuote => ({
  provider: 'lifi',
  tool: '1inch',
  crossChain: request.fromNetwork.id !== request.toNetwork.id,
  amountInRaw: request.amountRaw,
  amountOutRaw: out,
  minAmountOutRaw: (out * BigInt(10_000 - request.slippageBps)) / 10_000n,
  fees: [
    {
      kind: 'provider',
      label: 'LIFI Fixed Fee',
      amountRaw: 250_000n,
      symbol: 'USDC',
      decimals: 6,
      included: true,
    },
  ],
  priceImpactPct: null,
  etaSeconds: 30,
  quoteId: 'q-1',
  approvalAddress: null,
});

function quoteApp(impl?: (request: SwapQuoteRequest) => Promise<SwapQuote>) {
  const quote = vi.fn(impl ?? (async (request: SwapQuoteRequest) => quoteFor(request)));
  const app = createApp({
    ...makeDeps(seededDb(), {}),
    priceStaleAfterMs: 60_000,
    logRequests: false,
    swapQuotes: { quote },
  });
  const get = async (query: string) => {
    const res = await app.request(`/v1/swap/quote?${query}`);
    return { res, body: (await res.json()) as Record<string, any> };
  };
  return { get, quote };
}

describe('aturan slippage (sama dengan aplikasi)', () => {
  it.each([
    ['0.5', { ok: true, bps: 50, warning: null }],
    ['0,3', { ok: true, bps: 30, warning: null }],
    ['0.01', { ok: true, bps: 1, warning: 'low' }],
    ['3', { ok: true, bps: 300, warning: 'high' }],
    ['50', { ok: true, bps: 5000, warning: 'high' }],
    ['0', { ok: false, reason: 'zero' }],
    ['51', { ok: false, reason: 'too_high' }],
    ['0.123', { ok: false, reason: 'format' }],
    ['-1', { ok: false, reason: 'format' }],
    ['abc', { ok: false, reason: 'format' }],
  ])('%s', (input, expected) => {
    expect(checkSlippage(input)).toMatchObject(expected);
  });
});

describe('GET /v1/swap/quote', () => {
  it('estimasi lengkap: kurs, minimal diterima, biaya USD, batas waktu quote', async () => {
    const { get, quote } = quoteApp();
    const { res, body } = await get('from=usdc-arbitrum&to=usdt-arbitrum&amount=100&slippage=0.5');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(quote.mock.calls[0]![0]).toMatchObject({ amountRaw: 100_000_000n, slippageBps: 50 });
    expect(body).toMatchObject({
      provider: 'lifi',
      from: { tokenId: 'usdc-arbitrum', amount: '100' },
      to: { tokenId: 'usdt-arbitrum', amount: '99.77003', minAmount: '99.271179' },
      rate: 0.9977003,
      slippageBps: 50,
      slippagePercent: 0.5,
      includedFeesUsd: 0.25,
      warnings: [],
      quotedAt: TEST_NOW.toISOString(),
      expiresAt: new Date(TEST_NOW.getTime() + QUOTE_TTL_MS).toISOString(),
    });
  });

  it('slippage bawaan 0,5%; peringatan slippage tinggi dan kurs buruk', async () => {
    const { get, quote } = quoteApp(async (request) => quoteFor(request, 96_127_923n));
    const { body } = await get('from=usdc-arbitrum&to=usdc-solana&amount=100&slippage=2');
    expect(body.warnings).toEqual(['slippage_high', 'poor_rate']);

    await get('from=usdc-arbitrum&to=usdc-base&amount=1');
    expect(quote.mock.calls[1]![0].slippageBps).toBe(50);
  });

  it('alamat dinormalisasi dan diteruskan; quote dengan alamat tidak di-cache', async () => {
    const { get, quote } = quoteApp();
    const query = `from=usdc-arbitrum&to=usdc-solana&amount=5&fromAddress=0xd8da6bf26964af9d7eed9e03e53415d37aa96045&toAddress=${SOLANA_OWNER}`;
    await get(query);
    await get(query);
    expect(quote).toHaveBeenCalledTimes(2);
    expect(quote.mock.calls[0]![0]).toMatchObject({
      fromAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      toAddress: SOLANA_OWNER,
    });
  });

  it('quote tanpa alamat yang sama disimpan sebentar', async () => {
    const { get, quote } = quoteApp();
    await get('from=usdc-arbitrum&to=usdt-arbitrum&amount=100');
    await get('from=usdc-arbitrum&to=usdt-arbitrum&amount=100');
    await get('from=usdc-arbitrum&to=usdt-arbitrum&amount=100&slippage=1');
    expect(quote).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['from=eth-arbitrum&to=usdc-arbitrum&amount=1', 'unknown_from_token'],
    ['from=usdc-arbitrum&to=dai-ethereum&amount=1', 'unknown_to_token'],
    ['from=usdc-arbitrum&to=usdc-arbitrum&amount=1', 'same_token'],
    ['from=usdc-arbitrum&to=usdt-arbitrum&amount=0', 'invalid_amount'],
    ['from=usdc-arbitrum&to=usdt-arbitrum&amount=1.1234567', 'invalid_amount'],
    ['from=usdc-arbitrum&to=usdt-arbitrum&amount=1&slippage=0', 'invalid_slippage'],
    ['from=usdc-arbitrum&to=usdt-arbitrum&amount=1&slippage=60', 'invalid_slippage'],
    ['from=usdc-arbitrum&to=usdt-arbitrum&amount=1&fromAddress=0x12', 'invalid_from_address'],
    [
      'from=usdc-arbitrum&to=usdc-solana&amount=1&toAddress=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      'invalid_to_address',
    ],
  ])('menolak %s', async (query, error) => {
    const { get, quote } = quoteApp();
    const { res, body } = await get(query);
    expect(res.status).toBe(400);
    expect(body).toMatchObject({ error });
    expect(quote).not.toHaveBeenCalled();
  });

  it.each([
    ['no_route', 422],
    ['amount_too_small', 422],
    ['provider_error', 502],
  ] as const)('error agregator %s → %i', async (code, status) => {
    const { get } = quoteApp(async () =>
      Promise.reject(new SwapQuoteError(code, 'detail rahasia')),
    );
    const { res, body } = await get('from=usdc-arbitrum&to=usdt-arbitrum&amount=1');
    expect(res.status).toBe(status);
    expect(body.error).toBe(code);
    expect(JSON.stringify(body)).not.toContain('rahasia');
  });

  it('tanpa layanan quote → 503', async () => {
    const app = createApp({
      ...makeDeps(seededDb(), {}),
      priceStaleAfterMs: 60_000,
      logRequests: false,
    });
    const res = await app.request('/v1/swap/quote?from=usdc-arbitrum&to=usdt-arbitrum&amount=1');
    expect(res.status).toBe(503);
  });
});
