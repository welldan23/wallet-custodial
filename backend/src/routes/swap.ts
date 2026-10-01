import { isAddress as isSolanaAddress } from '@solana/kit';
import { Hono } from 'hono';
import { getAddress, isAddress as isEvmAddress, parseUnits } from 'viem';

import type { Catalog } from '../catalog/repository.js';
import { summarizeQuote } from '../swap/quote-service.js';
import { checkSlippage } from '../swap/slippage.js';
import { SwapQuoteError, type SwapQuote, type SwapQuoteRequest } from '../swap/types.js';
import type { ChainType, SwapProvider } from '../types.js';

export type SwapRouteDeps = {
  loadCatalog: () => Catalog;
  /** Tanpa ini, /v1/swap/quote menjawab 503. */
  swapQuotes?: { quote(request: SwapQuoteRequest): Promise<SwapQuote> };
  now?: () => Date;
};

/** Lama quote boleh dipakai sebelum harus diminta ulang (sama dengan layar konfirmasi). */
export const QUOTE_TTL_MS = 30_000;
/** Jawaban tanpa alamat disimpan sebentar supaya batas request agregator aman. */
const QUOTE_CACHE_MS = 10_000;
/** Stablecoin ke stablecoin: kurs di bawah ini patut diperingatkan. */
export const POOR_STABLE_RATE = 0.98;

const SLIPPAGE_MESSAGES = {
  format: 'slippage must be a percent with up to 2 decimals, e.g. 0.5.',
  zero: 'slippage must be greater than 0%.',
  too_high: 'slippage must be at most 50%.',
} as const;

const QUOTE_ERROR_STATUS = {
  no_route: 422,
  amount_too_small: 422,
  unsupported_pair: 422,
  provider_error: 502,
} as const;

const isValidAddress = (value: string, chainType: ChainType) =>
  chainType === 'solana' ? isSolanaAddress(value) : isEvmAddress(value, { strict: false });
const normalize = (value: string, chainType: ChainType) =>
  chainType === 'solana' ? value : getAddress(value);

export type SwapToken = {
  tokenId: string;
  symbol: string;
  name: string;
  decimals: number;
  /** Alamat kontrak (EVM) / mint (Solana). */
  contractAddress: string;
};

export type SwapNetwork = {
  id: string;
  name: string;
  chainType: ChainType;
  /** Agregator untuk swap di dalam jaringan ini. */
  sameChainProvider: SwapProvider;
  tokens: SwapToken[];
};

/** Agregator per tipe jaringan (PRD: LI.FI/0x untuk EVM, Jupiter untuk Solana). */
export const SAME_CHAIN_PROVIDER: Record<ChainType, SwapProvider> = {
  evm: 'lifi',
  solana: 'jupiter',
};
/** Swap beda jaringan (termasuk EVM ↔ Solana) lewat bridge LI.FI. */
export const BRIDGE_PROVIDER: SwapProvider = 'lifi';

/**
 * Stablecoin yang bisa ditukar, per jaringan aktif (urut `sort_order`).
 * Hanya token tampil yang bertanda stablecoin dan punya alamat kontrak;
 * jaringan tanpa stablecoin tidak ikut.
 */
export function listSwapNetworks(catalog: Catalog): SwapNetwork[] {
  return catalog.networks
    .filter((network) => network.isActive)
    .map((network) => ({
      id: network.id,
      name: network.name,
      chainType: network.chainType,
      sameChainProvider: SAME_CHAIN_PROVIDER[network.chainType],
      tokens: catalog.tokens
        .filter(
          (token) =>
            token.networkId === network.id &&
            token.isVisible &&
            token.isStablecoin &&
            token.contractAddress !== null,
        )
        .map((token) => ({
          tokenId: token.id,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          contractAddress: token.contractAddress!,
        })),
    }))
    .filter((network) => network.tokens.length > 0);
}

/** /v1/swap — data untuk halaman Swap. */
export function swapRoutes(deps: SwapRouteDeps): Hono {
  const app = new Hono();

  /** GET /v1/swap/tokens — stablecoin yang bisa ditukar per jaringan (data publik). */
  app.get('/tokens', (c) => {
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({
      networks: listSwapNetworks(deps.loadCatalog()),
      bridgeProvider: BRIDGE_PROVIDER,
    });
  });

  const cache = new Map<string, { at: number; body: unknown }>();
  const now = () => deps.now?.() ?? new Date();

  /**
   * GET /v1/swap/quote?from=usdc-arbitrum&to=usdt-arbitrum&amount=100&slippage=0.5
   *   [&fromAddress=…&toAddress=…]
   *
   * Estimasi swap antar stablecoin: kurs, jumlah & minimal diterima, biaya
   * (USD), dan peringatan. Slippage dalam persen, divalidasi seperti di aplikasi.
   */
  app.get('/quote', async (c) => {
    c.header('Cache-Control', 'no-store');
    const q = (name: string) => c.req.query(name)?.trim() || '';
    const catalog = deps.loadCatalog();
    const findToken = (id: string) =>
      catalog.tokens.find(
        (token) =>
          token.id === id &&
          token.isVisible &&
          token.isStablecoin &&
          token.contractAddress !== null,
      );
    const fromToken = findToken(q('from'));
    const toToken = findToken(q('to'));
    const fromNetwork = catalog.networks.find((n) => n.id === fromToken?.networkId && n.isActive);
    const toNetwork = catalog.networks.find((n) => n.id === toToken?.networkId && n.isActive);
    if (!fromToken || !fromNetwork) {
      return c.json(
        { error: 'unknown_from_token', message: 'from must be a supported stablecoin.' },
        400,
      );
    }
    if (!toToken || !toNetwork) {
      return c.json(
        { error: 'unknown_to_token', message: 'to must be a supported stablecoin.' },
        400,
      );
    }
    if (fromToken.id === toToken.id) {
      return c.json({ error: 'same_token', message: 'from and to must be different.' }, 400);
    }

    const amount = q('amount');
    const decimals = amount.split('.')[1]?.length ?? 0;
    if (!/^\d+(\.\d+)?$/.test(amount) || decimals > fromToken.decimals) {
      return c.json({ error: 'invalid_amount', message: 'amount is not a valid number.' }, 400);
    }
    const amountRaw = parseUnits(amount, fromToken.decimals);
    if (amountRaw <= 0n) {
      return c.json({ error: 'invalid_amount', message: 'amount must be greater than 0.' }, 400);
    }

    const slippage = checkSlippage(q('slippage') || '0.5');
    if (!slippage.ok) {
      return c.json(
        {
          error: 'invalid_slippage',
          reason: slippage.reason,
          message: SLIPPAGE_MESSAGES[slippage.reason],
        },
        400,
      );
    }

    const fromAddress = q('fromAddress') || undefined;
    const toAddress = q('toAddress') || undefined;
    if (fromAddress && !isValidAddress(fromAddress, fromNetwork.chainType)) {
      return c.json({ error: 'invalid_from_address', message: 'fromAddress is not valid.' }, 400);
    }
    if (toAddress && !isValidAddress(toAddress, toNetwork.chainType)) {
      return c.json({ error: 'invalid_to_address', message: 'toAddress is not valid.' }, 400);
    }
    if (!deps.swapQuotes) {
      return c.json(
        { error: 'quote_unavailable', message: 'Swap quotes are not configured.' },
        503,
      );
    }

    const request: SwapQuoteRequest = {
      fromNetwork,
      fromToken,
      toNetwork,
      toToken,
      amountRaw,
      slippageBps: slippage.bps,
      fromAddress: fromAddress && normalize(fromAddress, fromNetwork.chainType),
      toAddress: toAddress && normalize(toAddress, toNetwork.chainType),
    };
    const cacheKey =
      !fromAddress && !toAddress
        ? `${fromToken.id}>${toToken.id}:${amountRaw}:${slippage.bps}`
        : null;
    const cached = cacheKey ? cache.get(cacheKey) : undefined;
    if (cached && now().getTime() - cached.at < QUOTE_CACHE_MS) return c.json(cached.body);

    let quote: SwapQuote;
    try {
      quote = await deps.swapQuotes.quote(request);
    } catch (error) {
      if (error instanceof SwapQuoteError) {
        console.warn(`[swap] quote gagal: ${error.code}`);
        return c.json(
          { error: error.code, message: 'No swap quote is available right now.' },
          QUOTE_ERROR_STATUS[error.code],
        );
      }
      throw error;
    }

    const summary = summarizeQuote(quote, request, catalog);
    const warnings: string[] = [];
    if (slippage.warning === 'low') warnings.push('slippage_low');
    if (slippage.warning === 'high') warnings.push('slippage_high');
    // USDC/USDT sama-sama 1 USD: kurs jauh di bawah 1 = banyak biaya/selisih.
    if (summary.rate !== null && summary.rate < POOR_STABLE_RATE) warnings.push('poor_rate');
    if (summary.priceImpactPct !== null && summary.priceImpactPct > 1)
      warnings.push('high_price_impact');

    const quotedAt = now();
    const body = {
      ...summary,
      slippagePercent: slippage.percent,
      warnings,
      quotedAt: quotedAt.toISOString(),
      expiresAt: new Date(quotedAt.getTime() + QUOTE_TTL_MS).toISOString(),
    };
    if (cacheKey) {
      cache.set(cacheKey, { at: quotedAt.getTime(), body });
      if (cache.size > 200) cache.delete(cache.keys().next().value!);
    }
    return c.json(body);
  });

  return app;
}
