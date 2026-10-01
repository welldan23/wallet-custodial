import { formatUnits } from 'viem';

import type { Catalog } from '../catalog/repository.js';
import { BASE_FEE_PER_SIGNATURE, medianCeil, type SolanaFeeRpc } from '../fees/solana.js';

import {
  SwapQuoteError,
  type SwapQuote,
  type SwapQuoteRequest,
  type SwapQuoteSource,
} from './types.js';

/** Batas compute unit yang umum untuk swap stablecoin lewat Jupiter. */
export const JUPITER_SWAP_COMPUTE_UNITS = 300_000n;

/** Biaya jaringan swap Solana: biaya dasar + priority fee median (bukan nol) di akun mint. */
export function solanaSwapFeeEstimator(rpc: SolanaFeeRpc) {
  return async (mints: string[]) => {
    const recent = (await rpc.recentPriorityFees(mints)).filter((fee) => fee > 0n);
    const priority = (medianCeil(recent) * JUPITER_SWAP_COMPUTE_UNITS + 999_999n) / 1_000_000n;
    return BASE_FEE_PER_SIGNATURE + priority;
  };
}

/**
 * Pilih agregator: swap di dalam Solana → Jupiter (cadangan LI.FI kalau
 * Jupiter gagal); EVM dan semua swap beda jaringan → LI.FI.
 */
export class SwapQuoteService {
  constructor(private readonly sources: { lifi: SwapQuoteSource; jupiter: SwapQuoteSource }) {}

  async quote(request: SwapQuoteRequest): Promise<SwapQuote> {
    if (!request.fromToken.contractAddress || !request.toToken.contractAddress) {
      throw new SwapQuoteError('unsupported_pair');
    }
    if (request.fromToken.id === request.toToken.id) throw new SwapQuoteError('unsupported_pair');

    const sameSolana =
      request.fromNetwork.chainType === 'solana' && request.fromNetwork.id === request.toNetwork.id;
    if (!sameSolana) return this.sources.lifi.quote(request);
    try {
      return await this.sources.jupiter.quote(request);
    } catch (error) {
      if (error instanceof SwapQuoteError && error.code === 'provider_error') {
        return this.sources.lifi.quote(request);
      }
      throw error;
    }
  }
}

const usdOf = (catalog: Catalog, symbol: string, amountRaw: bigint, decimals: number) => {
  const price = catalog.pricesBySymbol.get(symbol);
  return price ? Number(formatUnits(amountRaw, decimals)) * price.usdPrice : null;
};
const round = (value: number, digits = 6) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * Ringkas quote untuk aplikasi: jumlah dalam satuan token, kurs (berapa
 * koin tujuan per 1 koin asal, setelah biaya yang dipotong), dan semua biaya
 * dalam USD — dipisah antara yang sudah dipotong dan yang dibayar terpisah.
 */
export function summarizeQuote(quote: SwapQuote, request: SwapQuoteRequest, catalog: Catalog) {
  const amountIn = formatUnits(quote.amountInRaw, request.fromToken.decimals);
  const amountOut = formatUnits(quote.amountOutRaw, request.toToken.decimals);
  const fees = quote.fees.map((fee) => {
    const usd = usdOf(catalog, fee.symbol, fee.amountRaw, fee.decimals);
    return {
      kind: fee.kind,
      label: fee.label,
      symbol: fee.symbol,
      amount: formatUnits(fee.amountRaw, fee.decimals),
      amountRaw: fee.amountRaw.toString(),
      usd: usd === null ? null : round(usd),
      included: fee.included,
    };
  });
  const sum = (included: boolean) =>
    round(
      fees.filter((fee) => fee.included === included).reduce((s, fee) => s + (fee.usd ?? 0), 0),
    );

  return {
    provider: quote.provider,
    tool: quote.tool,
    crossChain: quote.crossChain,
    from: {
      tokenId: request.fromToken.id,
      symbol: request.fromToken.symbol,
      amount: amountIn,
      amountRaw: quote.amountInRaw.toString(),
    },
    to: {
      tokenId: request.toToken.id,
      symbol: request.toToken.symbol,
      amount: amountOut,
      amountRaw: quote.amountOutRaw.toString(),
      minAmount: formatUnits(quote.minAmountOutRaw, request.toToken.decimals),
      minAmountRaw: quote.minAmountOutRaw.toString(),
    },
    rate: Number(amountIn) > 0 ? round(Number(amountOut) / Number(amountIn), 8) : null,
    slippageBps: request.slippageBps,
    priceImpactPct: quote.priceImpactPct === null ? null : round(quote.priceImpactPct, 4),
    fees,
    /** Biaya yang sudah dipotong dari jumlah diterima (mis. biaya LI.FI, bridge). */
    includedFeesUsd: sum(true),
    /** Biaya yang dibayar terpisah dengan koin gas (biaya jaringan). */
    networkFeesUsd: sum(false),
    etaSeconds: quote.etaSeconds,
    quoteId: quote.quoteId,
    approvalAddress: quote.approvalAddress,
  };
}
