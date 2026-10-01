import { isAddress as isSolanaAddress } from '@solana/kit';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress as isEvmAddress,
  parseUnits,
} from 'viem';

import type { Catalog } from '../catalog/repository.js';
import { withTimeout } from '../lib/timeout.js';
import type { AllowanceReader } from '../swap/allowance.js';
import type { SwapIntent, SwapIntentStore } from '../swap/intents.js';
import { summarizeQuote } from '../swap/quote-service.js';
import { checkSlippage } from '../swap/slippage.js';
import { SwapQuoteError, type SwapQuote, type SwapQuoteRequest } from '../swap/types.js';
import { solanaRouterProgram, verifyPreparedEvm, verifyPreparedSolana } from '../swap/verify.js';
import type { TransactionStore } from '../transactions/store.js';
import {
  BroadcastRejectedError,
  TransactionDecodeError,
  type TransactionBroadcaster,
} from '../transactions/types.js';
import type { ChainType, SwapProvider } from '../types.js';

import type { StatusRefresher } from '../transactions/refresh.js';

import { isTransactionId, publicTransaction, statusBody } from './transactions.js';

export type SwapRouteDeps = {
  loadCatalog: () => Catalog;
  /** Tanpa ini, /v1/swap/quote dan /prepare menjawab 503. */
  swapQuotes?: { quote(request: SwapQuoteRequest): Promise<SwapQuote> };
  /** Untuk /prepare dan /execute (swap sungguhan). */
  swapExecution?: {
    intents: SwapIntentStore;
    allowanceOf: AllowanceReader;
    /** Jupiter: buat transaksi swap (base64, belum ditandatangani). */
    buildJupiterSwap: (quoteResponse: unknown, userPublicKey: string) => Promise<string>;
    broadcasters: Map<string, TransactionBroadcaster>;
    transactionStore: TransactionStore;
    walletKey: (address: string) => string;
  };
  /** Untuk GET /history dan /:id. */
  history?: {
    transactionStore: TransactionStore;
    walletKey: (address: string) => string;
    refresher: StatusRefresher;
  };
  rpcTimeoutMs?: number;
  now?: () => Date;
};

const HISTORY_DEFAULT_LIMIT = 20;
const HISTORY_MAX_LIMIT = 50;

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

const EXECUTE_MESSAGES: Record<string, string> = {
  invalid_encoding: 'signedTransaction is not a valid signed transaction.',
  unsigned: 'The transaction must be signed by the swap sender.',
  wrong_chain: 'The transaction was signed for a different chain.',
  unsupported_transaction: 'The signed transaction does not match the prepared swap.',
  insufficient_funds: 'Not enough balance to cover the swap and network fee.',
  nonce_too_low: 'This transaction was already replaced or sent.',
  fee_too_low: 'The network fee is too low right now. Please try again.',
  blockhash_expired: 'The swap expired before it was sent. Please prepare it again.',
  rejected: 'The network rejected this swap.',
};

const isValidAddress = (value: string, chainType: ChainType) =>
  chainType === 'solana' ? isSolanaAddress(value) : isEvmAddress(value, { strict: false });
const normalize = (value: string, chainType: ChainType) =>
  chainType === 'solana' ? value : getAddress(value);

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

type ParamError = { status: 400; body: { error: string; message: string; reason?: string } };
type ParsedSwap = {
  request: SwapQuoteRequest;
  slippagePercent: number;
  slippageWarning: 'low' | 'high' | null;
};

/** Validasi parameter swap (dipakai /quote dan /prepare). */
export function parseSwapParams(
  input: Record<string, unknown>,
  catalog: Catalog,
): ParsedSwap | ParamError {
  const str = (name: string) =>
    typeof input[name] === 'string' ? (input[name] as string).trim() : '';
  const fail = (error: string, message: string, reason?: string): ParamError => ({
    status: 400,
    body: reason ? { error, message, reason } : { error, message },
  });
  const findToken = (id: string) =>
    catalog.tokens.find(
      (token) =>
        token.id === id && token.isVisible && token.isStablecoin && token.contractAddress !== null,
    );
  const fromToken = findToken(str('from'));
  const toToken = findToken(str('to'));
  const fromNetwork = catalog.networks.find((n) => n.id === fromToken?.networkId && n.isActive);
  const toNetwork = catalog.networks.find((n) => n.id === toToken?.networkId && n.isActive);
  if (!fromToken || !fromNetwork)
    return fail('unknown_from_token', 'from must be a supported stablecoin.');
  if (!toToken || !toNetwork) return fail('unknown_to_token', 'to must be a supported stablecoin.');
  if (fromToken.id === toToken.id) return fail('same_token', 'from and to must be different.');

  const amount = str('amount');
  const decimals = amount.split('.')[1]?.length ?? 0;
  if (!/^\d+(\.\d+)?$/.test(amount) || decimals > fromToken.decimals) {
    return fail('invalid_amount', 'amount is not a valid number.');
  }
  const amountRaw = parseUnits(amount, fromToken.decimals);
  if (amountRaw <= 0n) return fail('invalid_amount', 'amount must be greater than 0.');

  const slippage = checkSlippage(str('slippage') || '0.5');
  if (!slippage.ok) {
    return fail('invalid_slippage', SLIPPAGE_MESSAGES[slippage.reason], slippage.reason);
  }

  const fromAddress = str('fromAddress') || undefined;
  const toAddress = str('toAddress') || undefined;
  if (fromAddress && !isValidAddress(fromAddress, fromNetwork.chainType)) {
    return fail('invalid_from_address', 'fromAddress is not valid.');
  }
  if (toAddress && !isValidAddress(toAddress, toNetwork.chainType)) {
    return fail('invalid_to_address', 'toAddress is not valid.');
  }

  return {
    request: {
      fromNetwork,
      fromToken,
      toNetwork,
      toToken,
      amountRaw,
      slippageBps: slippage.bps,
      fromAddress: fromAddress && normalize(fromAddress, fromNetwork.chainType),
      toAddress: toAddress && normalize(toAddress, toNetwork.chainType),
    },
    slippagePercent: slippage.percent,
    slippageWarning: slippage.warning,
  };
}

/** Ringkasan quote + peringatan + batas waktu (bentuk jawaban /quote dan /prepare). */
function describe(quote: SwapQuote, parsed: ParsedSwap, catalog: Catalog, quotedAt: Date) {
  const summary = summarizeQuote(quote, parsed.request, catalog);
  const warnings: string[] = [];
  if (parsed.slippageWarning === 'low') warnings.push('slippage_low');
  if (parsed.slippageWarning === 'high') warnings.push('slippage_high');
  // USDC/USDT sama-sama 1 USD: kurs jauh di bawah 1 = banyak biaya/selisih.
  if (summary.rate !== null && summary.rate < POOR_STABLE_RATE) warnings.push('poor_rate');
  if (summary.priceImpactPct !== null && summary.priceImpactPct > 1)
    warnings.push('high_price_impact');
  return {
    ...summary,
    slippagePercent: parsed.slippagePercent,
    warnings,
    quotedAt: quotedAt.toISOString(),
    expiresAt: new Date(quotedAt.getTime() + QUOTE_TTL_MS).toISOString(),
  };
}

function quoteErrorResponse(c: Context, error: unknown) {
  if (error instanceof SwapQuoteError) {
    console.warn(`[swap] quote gagal: ${error.code}`);
    return c.json(
      { error: error.code, message: 'No swap quote is available right now.' },
      QUOTE_ERROR_STATUS[error.code],
    );
  }
  throw error;
}

/** /v1/swap — data, estimasi, dan eksekusi swap. */
export function swapRoutes(deps: SwapRouteDeps): Hono {
  const app = new Hono();
  const cache = new Map<string, { at: number; body: unknown }>();
  const now = () => deps.now?.() ?? new Date();

  /** GET /v1/swap/tokens — stablecoin yang bisa ditukar per jaringan (data publik). */
  app.get('/tokens', (c) => {
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({
      networks: listSwapNetworks(deps.loadCatalog()),
      bridgeProvider: BRIDGE_PROVIDER,
    });
  });

  /**
   * GET /v1/swap/quote?from=usdc-arbitrum&to=usdt-arbitrum&amount=100&slippage=0.5
   *   [&fromAddress=…&toAddress=…]
   *
   * Estimasi swap antar stablecoin: kurs, jumlah & minimal diterima, biaya
   * (USD), dan peringatan. Slippage dalam persen, divalidasi seperti di aplikasi.
   */
  app.get('/quote', async (c) => {
    c.header('Cache-Control', 'no-store');
    const catalog = deps.loadCatalog();
    const parsed = parseSwapParams(c.req.query(), catalog);
    if ('status' in parsed) return c.json(parsed.body, parsed.status);
    if (!deps.swapQuotes) {
      return c.json(
        { error: 'quote_unavailable', message: 'Swap quotes are not configured.' },
        503,
      );
    }

    const { request } = parsed;
    const cacheKey =
      !request.fromAddress && !request.toAddress
        ? `${request.fromToken.id}>${request.toToken.id}:${request.amountRaw}:${request.slippageBps}`
        : null;
    const cached = cacheKey ? cache.get(cacheKey) : undefined;
    if (cached && now().getTime() - cached.at < QUOTE_CACHE_MS) return c.json(cached.body);

    let quote: SwapQuote;
    try {
      quote = await deps.swapQuotes.quote(request);
    } catch (error) {
      return quoteErrorResponse(c, error);
    }
    const quotedAt = now();
    const body = describe(quote, parsed, catalog, quotedAt);
    if (cacheKey) {
      cache.set(cacheKey, { at: quotedAt.getTime(), body });
      if (cache.size > 200) cache.delete(cache.keys().next().value!);
    }
    return c.json(body);
  });

  const limit = bodyLimit({
    maxSize: 64 * 1024,
    onError: (c) => c.json({ error: 'body_too_large', message: 'Request body is too large.' }, 413),
  });

  /**
   * POST /v1/swap/prepare — siapkan swap sungguhan untuk ditandatangani di HP.
   * Body sama dengan parameter /quote, `fromAddress` wajib (dan `toAddress`
   * kalau tipe jaringan tujuan berbeda). Kalau token asal (EVM) belum diberi
   * izin, disertakan transaksi approve dengan jumlah PERSIS (bukan tak terbatas).
   */
  app.post('/prepare', limit, async (c) => {
    c.header('Cache-Control', 'no-store');
    const catalog = deps.loadCatalog();
    const input = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const parsed = parseSwapParams(input, catalog);
    if ('status' in parsed) return c.json(parsed.body, parsed.status);
    const { request } = parsed;
    if (!request.fromAddress) {
      return c.json({ error: 'missing_from_address', message: 'fromAddress is required.' }, 400);
    }
    if (request.fromNetwork.chainType !== request.toNetwork.chainType && !request.toAddress) {
      return c.json(
        { error: 'missing_to_address', message: 'toAddress is required for this route.' },
        400,
      );
    }
    const exec = deps.swapExecution;
    if (!deps.swapQuotes || !exec) {
      return c.json({ error: 'swap_unavailable', message: 'Swaps are not configured.' }, 503);
    }

    let quote: SwapQuote;
    let solanaTx: string | undefined;
    try {
      quote = await deps.swapQuotes.quote(request);
      if (quote.provider === 'jupiter') {
        solanaTx = await exec.buildJupiterSwap(quote.jupiterQuoteResponse, request.fromAddress);
      } else if (request.fromNetwork.chainType === 'solana') {
        solanaTx = quote.solanaTransaction;
      }
    } catch (error) {
      return quoteErrorResponse(c, error);
    }

    let prepared: SwapIntent['prepared'];
    let router: string | null;
    if (request.fromNetwork.chainType === 'solana') {
      if (!solanaTx)
        return c.json({ error: 'provider_error', message: 'No swap transaction.' }, 502);
      prepared = { chainType: 'solana', transaction: solanaTx };
      router = solanaRouterProgram(solanaTx);
    } else {
      const tx = quote.evmTransaction;
      if (!tx) return c.json({ error: 'provider_error', message: 'No swap transaction.' }, 502);
      let approval = null;
      if (quote.approvalAddress) {
        let allowance: bigint;
        try {
          allowance = await exec.allowanceOf(
            request.fromNetwork.id,
            request.fromToken.contractAddress!,
            request.fromAddress,
            quote.approvalAddress,
          );
        } catch (error) {
          console.warn(
            `[swap] allowance gagal: ${error instanceof Error ? error.name : 'unknown'}`,
          );
          return c.json({ error: 'rpc_error', message: 'Could not check token approval.' }, 502);
        }
        if (allowance < request.amountRaw) {
          approval = {
            to: request.fromToken.contractAddress!,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [quote.approvalAddress as `0x${string}`, request.amountRaw],
            }),
            value: 0n,
          };
        }
      }
      prepared = {
        chainType: 'evm',
        call: { to: tx.to, data: tx.data, value: tx.value },
        gasLimit: tx.gasLimit,
        approval,
      };
      router = tx.to;
    }

    const intent = exec.intents.save({
      request: { ...request, fromAddress: request.fromAddress },
      quote,
      router: router ?? request.fromAddress,
      prepared,
    });
    const chainId = request.fromNetwork.chainId;
    return c.json({
      intentId: intent.id,
      intentExpiresAt: new Date(intent.expiresAt).toISOString(),
      quote: describe(quote, parsed, catalog, now()),
      approval:
        prepared.chainType === 'evm' && prepared.approval
          ? { chainId, to: prepared.approval.to, data: prepared.approval.data, value: '0' }
          : null,
      transaction:
        prepared.chainType === 'evm'
          ? {
              chainType: 'evm',
              chainId,
              to: prepared.call.to,
              data: prepared.call.data,
              value: prepared.call.value.toString(),
              gasLimit: prepared.gasLimit?.toString() ?? null,
            }
          : { chainType: 'solana', serializedTransaction: prepared.transaction },
    });
  });

  /**
   * POST /v1/swap/execute — `{ intentId, signedTransaction, signedApproval? }`.
   * Transaksi bertanda tangan wajib sama persis dengan yang disiapkan; lalu
   * disiarkan (approve dulu kalau ada) dan dicatat di riwayat sebagai swap.
   */
  app.post('/execute', limit, async (c) => {
    c.header('Cache-Control', 'no-store');
    const exec = deps.swapExecution;
    if (!exec)
      return c.json({ error: 'swap_unavailable', message: 'Swaps are not configured.' }, 503);
    const body = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const signed = typeof body.signedTransaction === 'string' ? body.signedTransaction.trim() : '';
    const signedApproval =
      typeof body.signedApproval === 'string' ? body.signedApproval.trim() : '';
    const intent = typeof body.intentId === 'string' ? exec.intents.peek(body.intentId) : null;
    if (!intent) {
      return c.json({ error: 'intent_expired', message: 'Prepare the swap again.' }, 410);
    }
    if (!signed) {
      return c.json(
        { error: 'missing_transaction', message: 'signedTransaction is required.' },
        400,
      );
    }
    const { request, prepared } = intent;
    const broadcaster = exec.broadcasters.get(request.fromNetwork.id);
    if (!broadcaster) {
      return c.json({ error: 'broadcast_unavailable', message: 'No RPC for this network.' }, 503);
    }

    let txHash: string;
    try {
      if (prepared.chainType === 'evm') {
        const expected = { chainId: request.fromNetwork.chainId, from: request.fromAddress };
        if (prepared.approval) {
          if (!signedApproval) {
            return c.json(
              { error: 'approval_required', message: 'signedApproval is required.' },
              400,
            );
          }
          await verifyPreparedEvm(signedApproval, prepared.approval, expected);
        }
        txHash = await verifyPreparedEvm(signed, prepared.call, expected);
      } else {
        txHash = verifyPreparedSolana(signed, prepared.transaction, request.fromAddress);
      }
    } catch (error) {
      if (error instanceof TransactionDecodeError) {
        return c.json({ error: error.code, message: EXECUTE_MESSAGES[error.code] }, 400);
      }
      throw error;
    }

    // Sekali pakai: ambil sebelum menyiarkan supaya permintaan ganda tidak dobel.
    if (!exec.intents.take(intent.id)) {
      return c.json({ error: 'intent_expired', message: 'Prepare the swap again.' }, 410);
    }
    const timeoutMs = deps.rpcTimeoutMs ?? 8_000;
    try {
      if (prepared.chainType === 'evm' && prepared.approval) {
        await withTimeout(broadcaster.send(signedApproval), timeoutMs);
      }
      await withTimeout(broadcaster.send(signed), timeoutMs);
    } catch (error) {
      if (error instanceof BroadcastRejectedError) {
        return c.json({ error: error.code, message: EXECUTE_MESSAGES[error.code] }, 422);
      }
      console.warn(`[swap] broadcast gagal: ${error instanceof Error ? error.name : 'unknown'}`);
      return c.json(
        { error: 'rpc_error', message: 'Could not reach the network. Prepare and try again.' },
        502,
      );
    }

    const catalog = deps.loadCatalog();
    const price = catalog.pricesBySymbol.get(request.fromToken.symbol);
    const amountUsd = price
      ? Math.round(
          Number(formatUnits(request.amountRaw, request.fromToken.decimals)) * price.usdPrice * 1e6,
        ) / 1e6
      : null;
    const { transaction, created } = exec.transactionStore.insertSwapPending({
      walletKey: exec.walletKey(request.fromAddress),
      networkId: request.fromNetwork.id,
      tokenId: request.fromToken.id,
      amountRaw: request.amountRaw,
      amountUsd,
      counterpartyAddress: intent.router,
      txHash,
      provider: intent.quote.provider,
      toNetworkId: request.toNetwork.id,
      toTokenId: request.toToken.id,
      quotedAmountRaw: intent.quote.amountOutRaw,
      minAmountRaw: intent.quote.minAmountOutRaw,
      slippageBps: request.slippageBps,
      quoteId: intent.quote.quoteId,
    });
    return c.json({ transaction: publicTransaction(transaction, catalog) }, created ? 201 : 200);
  });

  /**
   * GET /v1/swap/history?evm=0x…&solana=…[&limit=20&before=<kursor>]
   * Riwayat swap milik alamat-alamat ini, terbaru dulu (status disimpan;
   * cek terbaru per swap lewat GET /v1/swap/:id).
   */
  app.get('/history', (c) => {
    c.header('Cache-Control', 'no-store');
    const history = deps.history;
    if (!history) return c.json({ error: 'history_unavailable', message: 'Not configured.' }, 503);
    const evm = c.req.query('evm')?.trim() || null;
    const solana = c.req.query('solana')?.trim() || null;
    if (!evm && !solana) {
      return c.json({ error: 'missing_address', message: 'Provide evm and/or solana.' }, 400);
    }
    if (evm && !isEvmAddress(evm, { strict: false })) {
      return c.json({ error: 'invalid_evm_address', message: 'evm is not a valid address.' }, 400);
    }
    if (solana && !isSolanaAddress(solana)) {
      return c.json(
        { error: 'invalid_solana_address', message: 'solana is not a valid address.' },
        400,
      );
    }
    const limitInput = Number(c.req.query('limit') ?? HISTORY_DEFAULT_LIMIT);
    const limit = Number.isInteger(limitInput)
      ? Math.min(Math.max(limitInput, 1), HISTORY_MAX_LIMIT)
      : HISTORY_DEFAULT_LIMIT;
    const before = c.req.query('before')?.trim() || undefined;
    if (before && !/^[^|]+\|[0-9a-f-]{36}$/i.test(before)) {
      return c.json({ error: 'invalid_cursor', message: 'before is not a valid cursor.' }, 400);
    }

    const keys = [
      evm && history.walletKey(getAddress(evm)),
      solana && history.walletKey(solana),
    ].filter((key): key is string => Boolean(key));
    const swaps = history.transactionStore.listSwaps(keys, { limit, before });
    const catalog = deps.loadCatalog();
    const last = swaps.at(-1);
    return c.json({
      swaps: swaps.map((swap) => publicTransaction(swap, catalog)),
      nextBefore: swaps.length === limit && last ? `${last.createdAt}|${last.id}` : null,
    });
  });

  /** GET /v1/swap/:id — status satu swap (cek blockchain/bridge kalau masih berjalan). */
  app.get('/:id', async (c) => {
    c.header('Cache-Control', 'no-store');
    const history = deps.history;
    if (!history) return c.json({ error: 'history_unavailable', message: 'Not configured.' }, 503);
    const id = c.req.param('id');
    const transaction = isTransactionId(id) ? history.transactionStore.findById(id) : null;
    if (!transaction || transaction.type !== 'swap') {
      return c.json({ error: 'not_found', message: 'Swap not found.' }, 404);
    }
    const result = await history.refresher.refresh(transaction);
    return c.json(
      statusBody(result, {
        loadCatalog: deps.loadCatalog,
        transactionStore: history.transactionStore,
      }),
    );
  });

  return app;
}
