import type { Network, SwapProvider, Token } from '../types.js';

export type SwapQuoteRequest = {
  fromNetwork: Network;
  fromToken: Token;
  toNetwork: Network;
  toToken: Token;
  /** Jumlah koin asal, satuan terkecil. */
  amountRaw: bigint;
  /** Slippage dalam basis poin (50 = 0,5%). */
  slippageBps: number;
  /** Alamat pengirim / penerima (opsional; tanpa ini dipakai alamat pengganti). */
  fromAddress?: string;
  toAddress?: string;
};

export type SwapFeeKind = 'provider' | 'bridge' | 'network';

export type SwapFee = {
  kind: SwapFeeKind;
  /** Nama dari penyedia, mis. "LIFI Fixed Fee". */
  label: string;
  /** Satuan terkecil token `symbol`. */
  amountRaw: bigint;
  symbol: string;
  decimals: number;
  /** `true` = sudah dipotong dari jumlah yang diterima (bukan bayar terpisah). */
  included: boolean;
};

/** Hasil quote yang sudah diseragamkan untuk semua agregator. */
export type SwapQuote = {
  provider: SwapProvider;
  /** Nama rute/DEX/bridge yang dipilih agregator (mis. "fly", "Byreal"). */
  tool: string | null;
  crossChain: boolean;
  amountInRaw: bigint;
  /** Perkiraan diterima (satuan terkecil token tujuan). */
  amountOutRaw: bigint;
  /** Minimal diterima setelah slippage. */
  minAmountOutRaw: bigint;
  fees: SwapFee[];
  /** Persen dampak harga (0.12 = 0,12%); `null` kalau penyedia tidak memberi. */
  priceImpactPct: number | null;
  etaSeconds: number;
  /** Id quote dari penyedia (kalau ada). */
  quoteId: string | null;
  /** Alamat yang perlu diberi izin (approve) token asal — EVM saja. */
  approvalAddress: string | null;
};

export type SwapQuoteErrorCode =
  'no_route' | 'amount_too_small' | 'provider_error' | 'unsupported_pair';

export class SwapQuoteError extends Error {
  constructor(
    readonly code: SwapQuoteErrorCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'SwapQuoteError';
  }
}

export interface SwapQuoteSource {
  quote(request: SwapQuoteRequest): Promise<SwapQuote>;
}
