import { SwapQuoteError, type SwapFee, type SwapQuote, type SwapQuoteSource } from './types.js';

/** Kunci chain Solana di LI.FI; EVM memakai chainId angka. */
const LIFI_SOLANA_CHAIN = 'SOL';
/** Alamat pengganti untuk quote tanpa alamat pengguna (tidak pernah dipakai mengirim). */
export const PLACEHOLDER_EVM = '0x000000000000000000000000000000000000dEaD';
export const PLACEHOLDER_SOLANA = '11111111111111111111111111111111';

type LifiCost = {
  name?: string;
  type?: string;
  amount?: string;
  included?: boolean;
  token?: { symbol?: string; decimals?: number };
};

type LifiQuote = {
  id?: string;
  tool?: string;
  estimate?: {
    toAmount?: string;
    toAmountMin?: string;
    executionDuration?: number;
    approvalAddress?: string;
    gasCosts?: LifiCost[];
    feeCosts?: LifiCost[];
  };
  transactionRequest?: { to?: string; data?: string; value?: string; gasLimit?: string };
  message?: string;
  code?: number;
};

export type LifiOptions = {
  baseUrl?: string;
  apiKey?: string;
  integrator?: string;
  timeoutMs: number;
  fetch?: typeof fetch;
};

const chainOf = (network: { chainType: string; chainId: string }) =>
  network.chainType === 'solana' ? LIFI_SOLANA_CHAIN : network.chainId;

const placeholderFor = (network: { chainType: string }) =>
  network.chainType === 'solana' ? PLACEHOLDER_SOLANA : PLACEHOLDER_EVM;

const toFee = (cost: LifiCost, kind: SwapFee['kind']): SwapFee | null => {
  if (!cost.amount || !cost.token?.symbol || cost.token.decimals === undefined) return null;
  return {
    kind,
    label: cost.name ?? cost.type ?? kind,
    amountRaw: BigInt(cost.amount),
    symbol: cost.token.symbol,
    decimals: cost.token.decimals,
    // Biaya gas dibayar terpisah dengan koin gas; biaya LI.FI/bridge dipotong dari jumlah.
    included: kind === 'network' ? false : (cost.included ?? true),
  };
};

/**
 * Quote LI.FI (`GET /v1/quote`) untuk swap EVM dan semua swap beda jaringan
 * (termasuk ke/dari Solana). Biaya LI.FI & bridge tercantum di `feeCosts`,
 * biaya gas di `gasCosts`.
 */
export function lifiQuoteSource(options: LifiOptions): SwapQuoteSource {
  const baseUrl = options.baseUrl ?? 'https://li.quest';
  const doFetch = options.fetch ?? fetch;

  return {
    async quote(request) {
      const params = new URLSearchParams({
        fromChain: chainOf(request.fromNetwork),
        toChain: chainOf(request.toNetwork),
        fromToken: request.fromToken.contractAddress ?? '',
        toToken: request.toToken.contractAddress ?? '',
        fromAmount: request.amountRaw.toString(),
        fromAddress: request.fromAddress ?? placeholderFor(request.fromNetwork),
        toAddress: request.toAddress ?? request.fromAddress ?? placeholderFor(request.toNetwork),
        slippage: String(request.slippageBps / 10_000),
      });
      if (request.fromNetwork.chainType !== request.toNetwork.chainType && !request.toAddress) {
        params.set('toAddress', placeholderFor(request.toNetwork));
      }
      if (options.integrator) params.set('integrator', options.integrator);

      let response: Response;
      try {
        response = await doFetch(`${baseUrl}/v1/quote?${params}`, {
          headers: options.apiKey ? { 'x-lifi-api-key': options.apiKey } : {},
          signal: AbortSignal.timeout(options.timeoutMs),
        });
      } catch (error) {
        throw new SwapQuoteError('provider_error', error instanceof Error ? error.name : undefined);
      }
      const body = (await response.json().catch(() => ({}))) as LifiQuote;
      if (!response.ok || !body.estimate?.toAmount) {
        // 404 / 1002 = tidak ada rute; pesan "too low" = jumlah terlalu kecil.
        if (/too (low|small)|minimum/i.test(body.message ?? '')) {
          throw new SwapQuoteError('amount_too_small');
        }
        if (response.status === 404 || response.status === 400 || body.code === 1002) {
          throw new SwapQuoteError('no_route');
        }
        throw new SwapQuoteError('provider_error', `http ${response.status}`);
      }

      const estimate = body.estimate;
      const fees = [
        ...(estimate.feeCosts ?? []).map((cost) =>
          toFee(cost, /bridge|relay/i.test(cost.name ?? '') ? 'bridge' : 'provider'),
        ),
        ...(estimate.gasCosts ?? []).map((cost) => toFee({ ...cost, name: 'Gas' }, 'network')),
      ].filter((fee): fee is SwapFee => fee !== null);

      const amountOutRaw = BigInt(estimate.toAmount!);
      const tx = body.transactionRequest;
      const fromSolana = request.fromNetwork.chainType === 'solana';
      return {
        provider: 'lifi',
        tool: body.tool ?? null,
        crossChain: request.fromNetwork.id !== request.toNetwork.id,
        amountInRaw: request.amountRaw,
        amountOutRaw,
        minAmountOutRaw: BigInt(estimate.toAmountMin ?? estimate.toAmount!),
        fees,
        priceImpactPct: null,
        etaSeconds: estimate.executionDuration ?? 0,
        quoteId: body.id ?? null,
        approvalAddress: fromSolana ? null : (estimate.approvalAddress ?? null),
        evmTransaction:
          !fromSolana && tx?.to && tx.data
            ? {
                to: tx.to,
                data: tx.data,
                value: BigInt(tx.value ?? '0'),
                gasLimit: tx.gasLimit ? BigInt(tx.gasLimit) : null,
              }
            : undefined,
        solanaTransaction: fromSolana && tx?.data ? tx.data : undefined,
      };
    },
  };
}
