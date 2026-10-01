import { describe, expect, it, vi } from 'vitest';

import { MVP_NETWORKS, MVP_TOKENS } from '../src/catalog/mvp.js';
import { loadCatalog } from '../src/catalog/repository.js';
import { jupiterQuoteSource } from '../src/swap/jupiter.js';
import { lifiQuoteSource, PLACEHOLDER_EVM, PLACEHOLDER_SOLANA } from '../src/swap/lifi.js';
import {
  SwapQuoteService,
  solanaSwapFeeEstimator,
  summarizeQuote,
} from '../src/swap/quote-service.js';
import {
  SwapQuoteError,
  type SwapQuote,
  type SwapQuoteRequest,
  type SwapQuoteSource,
} from '../src/swap/types.js';

import { seededDb } from './helpers.js';

const network = (id: string) => MVP_NETWORKS.find((item) => item.id === id)!;
const token = (id: string) => MVP_TOKENS.find((item) => item.id === id)!;

const request = (
  from: string,
  to: string,
  overrides: Partial<SwapQuoteRequest> = {},
): SwapQuoteRequest => ({
  fromNetwork: network(token(from).networkId),
  fromToken: token(from),
  toNetwork: network(token(to).networkId),
  toToken: token(to),
  amountRaw: 100_000_000n,
  slippageBps: 50,
  ...overrides,
});

const json = (status: number, body: unknown) =>
  vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status }),
  );

const LIFI_BODY = {
  id: 'quote-1',
  tool: '1inch',
  estimate: {
    toAmount: '99770030',
    toAmountMin: '99271180',
    executionDuration: 30,
    approvalAddress: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    feeCosts: [
      {
        name: 'LIFI Fixed Fee',
        amount: '250000',
        included: true,
        token: { symbol: 'USDC', decimals: 6 },
      },
    ],
    gasCosts: [{ type: 'SEND', amount: '7144000000000', token: { symbol: 'ETH', decimals: 18 } }],
  },
};

describe('sumber LI.FI', () => {
  it('memanggil /v1/quote dengan chain, token, jumlah, slippage desimal', async () => {
    const fetch = json(200, LIFI_BODY);
    const source = lifiQuoteSource({
      timeoutMs: 1_000,
      fetch,
      apiKey: 'kunci',
      integrator: 'mywallet',
    });
    const quote = await source.quote(request('usdc-arbitrum', 'usdt-arbitrum'));

    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.pathname).toBe('/v1/quote');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      fromChain: '42161',
      toChain: '42161',
      fromToken: token('usdc-arbitrum').contractAddress,
      toToken: token('usdt-arbitrum').contractAddress,
      fromAmount: '100000000',
      fromAddress: PLACEHOLDER_EVM,
      slippage: '0.005',
      integrator: 'mywallet',
    });
    expect(fetch.mock.calls[0]![1]?.headers).toEqual({ 'x-lifi-api-key': 'kunci' });

    expect(quote).toMatchObject({
      provider: 'lifi',
      tool: '1inch',
      crossChain: false,
      amountOutRaw: 99_770_030n,
      minAmountOutRaw: 99_271_180n,
      etaSeconds: 30,
      quoteId: 'quote-1',
      approvalAddress: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    });
    expect(quote.fees).toEqual([
      {
        kind: 'provider',
        label: 'LIFI Fixed Fee',
        amountRaw: 250_000n,
        symbol: 'USDC',
        decimals: 6,
        included: true,
      },
      {
        kind: 'network',
        label: 'Gas',
        amountRaw: 7_144_000_000_000n,
        symbol: 'ETH',
        decimals: 18,
        included: false,
      },
    ]);
  });

  it('EVM → Solana memakai chain SOL dan penerima Solana', async () => {
    const fetch = json(200, LIFI_BODY);
    await lifiQuoteSource({ timeoutMs: 1_000, fetch }).quote(
      request('usdc-arbitrum', 'usdc-solana', {
        fromAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      }),
    );
    const params = new URL(String(fetch.mock.calls[0]![0])).searchParams;
    expect(params.get('toChain')).toBe('SOL');
    expect(params.get('toAddress')).toBe(PLACEHOLDER_SOLANA);
  });

  it.each([
    [404, { message: 'No available quotes for the requested transfer', code: 1002 }, 'no_route'],
    [400, { message: 'The from amount is too low' }, 'amount_too_small'],
    [500, { message: 'boom' }, 'provider_error'],
  ])('HTTP %s → %s', async (status, body, code) => {
    const source = lifiQuoteSource({ timeoutMs: 1_000, fetch: json(status, body) });
    await expect(source.quote(request('usdc-arbitrum', 'usdt-arbitrum'))).rejects.toMatchObject({
      code,
    });
  });

  it('jaringan putus → provider_error', async () => {
    const source = lifiQuoteSource({
      timeoutMs: 1_000,
      fetch: vi.fn(async () => Promise.reject(new TypeError('fetch failed'))),
    });
    await expect(source.quote(request('usdc-arbitrum', 'usdt-arbitrum'))).rejects.toMatchObject({
      code: 'provider_error',
    });
  });
});

describe('sumber Jupiter', () => {
  const body = {
    outAmount: '100037456',
    otherAmountThreshold: '99537269',
    priceImpactPct: '0.0012',
    routePlan: [{ swapInfo: { label: 'Byreal' } }, { swapInfo: { label: 'Orca' } }],
  };

  it('quote ExactIn dengan slippage bps, biaya jaringan dihitung sendiri', async () => {
    const fetch = json(200, body);
    const estimateNetworkFee = vi.fn(async () => 11_000n);
    const quote = await jupiterQuoteSource({ timeoutMs: 1_000, fetch, estimateNetworkFee }).quote(
      request('usdc-solana', 'usdt-solana'),
    );
    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.origin + url.pathname).toBe('https://lite-api.jup.ag/swap/v1/quote');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      inputMint: token('usdc-solana').contractAddress,
      outputMint: token('usdt-solana').contractAddress,
      amount: '100000000',
      slippageBps: '50',
      swapMode: 'ExactIn',
    });
    expect(estimateNetworkFee).toHaveBeenCalledWith([
      token('usdc-solana').contractAddress,
      token('usdt-solana').contractAddress,
    ]);
    expect(quote).toMatchObject({
      provider: 'jupiter',
      tool: 'Byreal → Orca',
      amountOutRaw: 100_037_456n,
      minAmountOutRaw: 99_537_269n,
      priceImpactPct: 0.12,
      fees: [{ kind: 'network', amountRaw: 11_000n, symbol: 'SOL', included: false }],
    });
  });

  it('bukan Solana→Solana ditolak; tanpa rute → no_route', async () => {
    const opts = { timeoutMs: 1_000, estimateNetworkFee: async () => 0n };
    await expect(
      jupiterQuoteSource({ ...opts, fetch: json(200, body) }).quote(
        request('usdc-arbitrum', 'usdc-solana'),
      ),
    ).rejects.toMatchObject({ code: 'unsupported_pair' });
    await expect(
      jupiterQuoteSource({
        ...opts,
        fetch: json(400, {
          error: 'Could not find any route',
          errorCode: 'COULD_NOT_FIND_ANY_ROUTE',
        }),
      }).quote(request('usdc-solana', 'usdt-solana')),
    ).rejects.toMatchObject({ code: 'no_route' });
  });
});

const fakeQuote = (provider: 'lifi' | 'jupiter'): SwapQuote => ({
  provider,
  tool: null,
  crossChain: false,
  amountInRaw: 100_000_000n,
  amountOutRaw: 99_000_000n,
  minAmountOutRaw: 98_500_000n,
  fees: [],
  priceImpactPct: null,
  etaSeconds: 0,
  quoteId: null,
  approvalAddress: null,
});

function service(jupiter: SwapQuoteSource['quote'] = async () => fakeQuote('jupiter')) {
  const lifi = { quote: vi.fn(async () => fakeQuote('lifi')) };
  const jup = { quote: vi.fn(jupiter) };
  return { svc: new SwapQuoteService({ lifi, jupiter: jup }), lifi, jup };
}

describe('pemilihan agregator', () => {
  it('Solana→Solana lewat Jupiter; EVM dan beda jaringan lewat LI.FI', async () => {
    const { svc, lifi, jup } = service();
    expect((await svc.quote(request('usdc-solana', 'usdt-solana'))).provider).toBe('jupiter');
    expect((await svc.quote(request('usdc-arbitrum', 'usdt-arbitrum'))).provider).toBe('lifi');
    expect((await svc.quote(request('usdc-solana', 'usdc-base'))).provider).toBe('lifi');
    expect(jup.quote).toHaveBeenCalledTimes(1);
    expect(lifi.quote).toHaveBeenCalledTimes(2);
  });

  it('Jupiter error → cadangan LI.FI; tapi "tanpa rute" tidak dialihkan', async () => {
    const down = service(async () => Promise.reject(new SwapQuoteError('provider_error')));
    expect((await down.svc.quote(request('usdc-solana', 'usdt-solana'))).provider).toBe('lifi');

    const noRoute = service(async () => Promise.reject(new SwapQuoteError('no_route')));
    await expect(noRoute.svc.quote(request('usdc-solana', 'usdt-solana'))).rejects.toMatchObject({
      code: 'no_route',
    });
    expect(noRoute.lifi.quote).not.toHaveBeenCalled();
  });

  it('koin gas atau token yang sama tidak bisa di-swap', async () => {
    const { svc } = service();
    await expect(svc.quote(request('eth-arbitrum', 'usdc-arbitrum'))).rejects.toMatchObject({
      code: 'unsupported_pair',
    });
    await expect(svc.quote(request('usdc-arbitrum', 'usdc-arbitrum'))).rejects.toMatchObject({
      code: 'unsupported_pair',
    });
  });
});

describe('ringkasan quote', () => {
  it('jumlah token, kurs, dan biaya USD dipisah: dipotong vs bayar terpisah', async () => {
    const catalog = loadCatalog(seededDb()); // ETH 2980.5, USDC 1
    const req = request('usdc-arbitrum', 'usdt-arbitrum');
    const quote = await lifiQuoteSource({ timeoutMs: 1_000, fetch: json(200, LIFI_BODY) }).quote(
      req,
    );
    const summary = summarizeQuote(quote, req, catalog);
    expect(summary).toMatchObject({
      from: { symbol: 'USDC', amount: '100' },
      to: { symbol: 'USDT', amount: '99.77003', minAmount: '99.27118' },
      rate: 0.9977003,
      slippageBps: 50,
      includedFeesUsd: 0.25,
      networkFeesUsd: 0.021293, // 0.000007144 ETH × 2980.5 = 0.0212927
    });
    expect(summary.fees[0]).toMatchObject({
      kind: 'provider',
      amount: '0.25',
      usd: 0.25,
      included: true,
    });
  });

  it('biaya jaringan swap Solana: dasar + median priority bukan nol × 300 ribu CU', async () => {
    const estimate = solanaSwapFeeEstimator({
      recentPriorityFees: async () => [0n, 10_000n, 30_000n],
      accountExists: async () => true,
      rentExemptMinimum: async () => 0n,
    });
    // median(10_000, 30_000) = 20_000 µlamport × 300_000 / 1e6 = 6_000
    expect(await estimate(['a'])).toBe(5_000n + 6_000n);
  });
});
