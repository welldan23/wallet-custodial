/**
 * DATA TIRUAN swap — meniru jawaban agregator (LI.FI untuk EVM, Jupiter
 * untuk Solana) supaya tampilan bisa dibangun sebelum backend siap.
 */
import type { Network } from '@/types/wallet';

import { MOCK_PRICES, MOCK_TRANSFER_FEES_USD } from './wallet';

export type SwapProvider = 'LI.FI' | 'Jupiter';

export type SwapQuote = {
  provider: SwapProvider;
  /** `true` kalau koin asal & tujuan beda jaringan (lewat bridge). */
  crossChain: boolean;
  /** 1 koin asal = `rate` koin tujuan. */
  rate: number;
  toAmount: number;
  /** Perkiraan biaya jaringan + bridge dalam USD. */
  feeUsd: number;
  /** Perkiraan lama proses dalam detik. */
  etaSeconds: number;
};

/** Potongan kurs agregator/pool tiruan (0,03%). */
const MOCK_SPREAD = 0.0003;
/** Biaya bridge tiruan untuk swap beda jaringan (USD). */
const MOCK_BRIDGE_FEE_USD = 0.35;
/** Swap memanggil kontrak, jadi gasnya sekitar 2× transfer biasa. */
const SWAP_GAS_MULTIPLIER = 2;

const priceOf = (symbol: string) => MOCK_PRICES.find((p) => p.symbol === symbol)?.usdPrice ?? 0;

export function getMockSwapQuote(input: {
  fromSymbol: string;
  toSymbol: string;
  fromNetwork: Network;
  toNetwork: Network;
  amount: number;
}): SwapQuote | null {
  const fromPrice = priceOf(input.fromSymbol);
  const toPrice = priceOf(input.toSymbol);
  if (!(fromPrice > 0) || !(toPrice > 0)) return null;

  const crossChain = input.fromNetwork.id !== input.toNetwork.id;
  const bothSolana = input.fromNetwork.chainType === 'solana' && !crossChain;
  const rate = (fromPrice / toPrice) * (1 - MOCK_SPREAD);

  return {
    provider: bothSolana ? 'Jupiter' : 'LI.FI',
    crossChain,
    rate,
    toAmount: input.amount * rate,
    feeUsd:
      MOCK_TRANSFER_FEES_USD[input.fromNetwork.id] * SWAP_GAS_MULTIPLIER +
      (crossChain ? MOCK_BRIDGE_FEE_USD : 0),
    etaSeconds: crossChain ? 120 : input.fromNetwork.chainType === 'solana' ? 5 : 20,
  };
}
