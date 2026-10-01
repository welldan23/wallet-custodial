import { SwapQuoteError, type SwapQuote, type SwapQuoteSource } from './types.js';

type JupiterQuote = {
  outAmount?: string;
  otherAmountThreshold?: string;
  priceImpactPct?: string;
  routePlan?: { swapInfo?: { label?: string } }[];
  error?: string;
  errorCode?: string;
};

export type JupiterOptions = {
  /** Default `https://lite-api.jup.ag` (gratis); `https://api.jup.ag` butuh API key. */
  baseUrl?: string;
  apiKey?: string;
  timeoutMs: number;
  /** Perkiraan biaya jaringan swap Solana (lamport). Jupiter tidak memberinya. */
  estimateNetworkFee: (mints: string[]) => Promise<bigint>;
  fetch?: typeof fetch;
};

/** Quote Jupiter (`GET /swap/v1/quote`) untuk swap di dalam Solana. */
export function jupiterQuoteSource(options: JupiterOptions): SwapQuoteSource {
  const baseUrl = options.baseUrl ?? 'https://lite-api.jup.ag';
  const doFetch = options.fetch ?? fetch;

  return {
    async quote(request) {
      if (
        request.fromNetwork.chainType !== 'solana' ||
        request.toNetwork.id !== request.fromNetwork.id
      ) {
        throw new SwapQuoteError('unsupported_pair');
      }
      const inputMint = request.fromToken.contractAddress ?? '';
      const outputMint = request.toToken.contractAddress ?? '';
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: request.amountRaw.toString(),
        slippageBps: String(request.slippageBps),
        swapMode: 'ExactIn',
      });

      let response: Response;
      try {
        response = await doFetch(`${baseUrl}/swap/v1/quote?${params}`, {
          headers: options.apiKey ? { 'x-api-key': options.apiKey } : {},
          signal: AbortSignal.timeout(options.timeoutMs),
        });
      } catch (error) {
        throw new SwapQuoteError('provider_error', error instanceof Error ? error.name : undefined);
      }
      const body = (await response.json().catch(() => ({}))) as JupiterQuote;
      if (!response.ok || !body.outAmount) {
        if (/no.?route|could not find any route/i.test(`${body.errorCode} ${body.error}`)) {
          throw new SwapQuoteError('no_route');
        }
        if (/too small|cannot compute/i.test(body.error ?? '')) {
          throw new SwapQuoteError('amount_too_small');
        }
        throw new SwapQuoteError('provider_error', `http ${response.status}`);
      }

      const networkFee = await options.estimateNetworkFee([inputMint, outputMint]);
      const impact = Number(body.priceImpactPct);
      return {
        provider: 'jupiter',
        tool:
          body.routePlan
            ?.map((step) => step.swapInfo?.label)
            .filter(Boolean)
            .join(' → ') || null,
        crossChain: false,
        amountInRaw: request.amountRaw,
        amountOutRaw: BigInt(body.outAmount),
        minAmountOutRaw: BigInt(body.otherAmountThreshold ?? body.outAmount),
        fees: [
          {
            kind: 'network',
            label: 'Network fee',
            amountRaw: networkFee,
            symbol: 'SOL',
            decimals: 9,
            included: false,
          },
        ],
        // Jupiter memberi rasio (0.0012 = 0,12%) → ubah ke persen.
        priceImpactPct: Number.isFinite(impact) ? impact * 100 : null,
        etaSeconds: 5,
        quoteId: null,
        approvalAddress: null,
        jupiterQuoteResponse: body,
      } satisfies SwapQuote;
    },
  };
}

/**
 * Buat transaksi swap Jupiter (`POST /swap/v1/swap`) untuk dompet pengguna.
 * Hasilnya transaksi versioned (base64) yang BELUM ditandatangani.
 */
export async function buildJupiterSwap(
  options: Pick<JupiterOptions, 'baseUrl' | 'apiKey' | 'timeoutMs' | 'fetch'>,
  quoteResponse: unknown,
  userPublicKey: string,
): Promise<string> {
  const doFetch = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await doFetch(`${options.baseUrl ?? 'https://lite-api.jup.ag'}/swap/v1/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.apiKey ? { 'x-api-key': options.apiKey } : {}),
      },
      body: JSON.stringify({ quoteResponse, userPublicKey, dynamicComputeUnitLimit: true }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    throw new SwapQuoteError('provider_error', error instanceof Error ? error.name : undefined);
  }
  const body = (await response.json().catch(() => ({}))) as { swapTransaction?: string };
  if (!response.ok || !body.swapTransaction) {
    throw new SwapQuoteError('provider_error', `http ${response.status}`);
  }
  return body.swapTransaction;
}
