export type SendQuoteInput = {
  amount: number;
  /** Harga USD aset yang dikirim. */
  assetUsdPrice: number;
  /** `true` kalau yang dikirim adalah koin gas itu sendiri (ETH/POL/SOL). */
  isNativeAsset: boolean;
  /** Perkiraan biaya jaringan dalam USD. */
  feeUsd: number;
  /** Harga USD koin gas jaringan. */
  nativeUsdPrice: number;
  /** Saldo koin gas di jaringan ini. */
  nativeBalance: number;
};

export type SendQuote = {
  amountUsd: number;
  /** Biaya jaringan dalam koin gas. */
  feeNative: number;
  feeUsd: number;
  /** Koin gas yang dibutuhkan total (biaya + jumlah kalau kirim koin gas). */
  nativeNeeded: number;
  hasEnoughGas: boolean;
  totalUsd: number;
};

/** Rincian kirim: nilai, biaya jaringan dalam koin gas, dan cukup-tidaknya gas. */
export function buildSendQuote(input: SendQuoteInput): SendQuote {
  const feeNative = input.nativeUsdPrice > 0 ? input.feeUsd / input.nativeUsdPrice : 0;
  const nativeNeeded = feeNative + (input.isNativeAsset ? input.amount : 0);
  const amountUsd = input.amount * input.assetUsdPrice;
  return {
    amountUsd,
    feeNative,
    feeUsd: input.feeUsd,
    nativeNeeded,
    hasEnoughGas: input.nativeBalance + 1e-12 >= nativeNeeded,
    totalUsd: amountUsd + input.feeUsd,
  };
}
