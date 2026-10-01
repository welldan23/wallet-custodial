import { isAddress as isSolanaAddress } from '@solana/kit';
import { Hono } from 'hono';
import { formatUnits, getAddress, isAddress as isEvmAddress, parseUnits } from 'viem';

import type { Catalog } from '../catalog/repository.js';
import type { FeeEstimate, FeeEstimator } from '../fees/types.js';
import { TimeoutError, withTimeout } from '../lib/timeout.js';
import type { ChainType } from '../types.js';

export type FeesRouteDeps = {
  loadCatalog: () => Catalog;
  feeEstimators: Map<string, FeeEstimator>;
  rpcTimeoutMs: number;
  priceStaleAfterMs: number;
  /** Lama jawaban tanpa alamat disimpan di memori (biar RPC tidak dibanjiri). */
  feeCacheTtlMs?: number;
  now?: () => Date;
};

const isValidAddress = (value: string, chainType: ChainType) =>
  chainType === 'solana' ? isSolanaAddress(value) : isEvmAddress(value, { strict: false });

const normalizeAddress = (value: string, chainType: ChainType) =>
  chainType === 'solana' ? value : getAddress(value);

const roundMoney = (value: number) => Math.round(value * 1e6) / 1e6;

/**
 * GET /v1/fees?network=arbitrum&token=usdc-arbitrum[&from=…&to=…&amount=12.5]
 *
 * Estimasi biaya kirim (dalam koin gas, USD, dan Rupiah) + metadata jaringan.
 * `from`/`to`/`amount` opsional; kalau ada, simulasinya lebih akurat.
 */
export function feesRoutes(deps: FeesRouteDeps): Hono {
  const app = new Hono();
  const cache = new Map<string, { at: number; body: unknown }>();
  const ttlMs = deps.feeCacheTtlMs ?? 15_000;
  const now = () => deps.now?.() ?? new Date();

  app.get('/', async (c) => {
    const networkId = c.req.query('network')?.trim() ?? '';
    const tokenId = c.req.query('token')?.trim() ?? '';
    const fromInput = c.req.query('from')?.trim() || undefined;
    const toInput = c.req.query('to')?.trim() || undefined;
    const amountInput = c.req.query('amount')?.trim() || undefined;

    const catalog = deps.loadCatalog();
    const network = catalog.networks.find((item) => item.id === networkId && item.isActive);
    if (!network) {
      return c.json({ error: 'unknown_network', message: 'network is not supported.' }, 400);
    }
    const token = catalog.tokens.find(
      (item) => item.id === tokenId && item.networkId === network.id && item.isVisible,
    );
    if (!token) {
      return c.json({ error: 'unknown_token', message: 'token is not on this network.' }, 400);
    }
    if (fromInput && !isValidAddress(fromInput, network.chainType)) {
      return c.json({ error: 'invalid_from', message: 'from is not a valid address.' }, 400);
    }
    if (toInput && !isValidAddress(toInput, network.chainType)) {
      return c.json({ error: 'invalid_to', message: 'to is not a valid address.' }, 400);
    }
    let amountRaw: bigint | undefined;
    if (amountInput) {
      const decimals = amountInput.split('.')[1]?.length ?? 0;
      if (!/^\d+(\.\d+)?$/.test(amountInput) || decimals > token.decimals) {
        return c.json({ error: 'invalid_amount', message: 'amount is not a valid number.' }, 400);
      }
      amountRaw = parseUnits(amountInput, token.decimals);
    }

    const estimator = deps.feeEstimators.get(network.id);
    if (!estimator) {
      return c.json({ error: 'fee_unavailable', message: 'No RPC for this network.' }, 503);
    }

    const from = fromInput && normalizeAddress(fromInput, network.chainType);
    const to = toInput && normalizeAddress(toInput, network.chainType);
    const isPrivate = Boolean(from || to);
    // Ada alamat → jawaban khusus orang ini, jangan disimpan CDN maupun memori.
    c.header('Cache-Control', isPrivate ? 'no-store' : 'public, max-age=15');

    const cacheKey = `${network.id}:${token.id}:${amountRaw ?? ''}`;
    const cached = isPrivate ? undefined : cache.get(cacheKey);
    if (cached && now().getTime() - cached.at < ttlMs) return c.json(cached.body);

    let estimate: FeeEstimate;
    try {
      estimate = await withTimeout(
        estimator.estimate({ token, from, to, amountRaw }),
        deps.rpcTimeoutMs,
      );
    } catch (error) {
      console.warn(
        `[fees] ${network.id} gagal: ${error instanceof Error ? error.name : 'unknown'}`,
      );
      const code = error instanceof TimeoutError ? 'rpc_timeout' : 'rpc_error';
      return c.json({ error: code, message: 'Could not estimate the fee right now.' }, 502);
    }

    const nativeToken = catalog.tokens.find(
      (item) => item.networkId === network.id && item.contractAddress === null,
    );
    const nativeDecimals = nativeToken?.decimals ?? (network.chainType === 'solana' ? 9 : 18);
    const nativePrice = catalog.pricesBySymbol.get(network.nativeSymbol) ?? null;
    const toAmount = (raw: bigint) => formatUnits(raw, nativeDecimals);
    const totalAmount = toAmount(estimate.totalRaw);
    const usd = nativePrice ? roundMoney(Number(totalAmount) * nativePrice.usdPrice) : null;

    const body = {
      network: {
        id: network.id,
        name: network.name,
        chainId: network.chainId,
        chainType: network.chainType,
        nativeSymbol: network.nativeSymbol,
        nativeDecimals,
        explorerUrl: network.explorerUrl,
        explorerTxUrl: `${network.explorerUrl.replace(/\/$/, '')}/tx/{hash}`,
      },
      token: {
        tokenId: token.id,
        symbol: token.symbol,
        decimals: token.decimals,
        isNative: token.contractAddress === null,
      },
      fee: {
        raw: estimate.totalRaw.toString(),
        amount: totalAmount,
        usd,
        idr: usd !== null && nativePrice ? Math.round(usd * nativePrice.idrRate) : null,
        method: estimate.method,
        parts: estimate.parts.map((part) => ({
          kind: part.kind,
          raw: part.raw.toString(),
          amount: toAmount(part.raw),
        })),
        gasLimit: estimate.gasLimit?.toString() ?? null,
        maxFeePerGas: estimate.maxFeePerGas?.toString() ?? null,
        createsRecipientAccount: estimate.createsRecipientAccount ?? null,
      },
      nativeUsdPrice: nativePrice?.usdPrice ?? null,
      isPriceStale:
        !nativePrice ||
        now().getTime() - new Date(nativePrice.updatedAt).getTime() > deps.priceStaleAfterMs,
      estimatedAt: now().toISOString(),
    };

    if (!isPrivate) {
      cache.set(cacheKey, { at: now().getTime(), body });
      if (cache.size > 200) cache.delete(cache.keys().next().value!);
    }
    return c.json(body);
  });

  return app;
}
