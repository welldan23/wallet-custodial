import { useEffect, useState } from 'react';

import { getMockSwapQuote, type SwapQuote } from '@/mocks/swap';

import type { SwapAsset } from './use-swap-assets';

/** Jeda setelah berhenti mengetik sebelum minta kurs (biar tidak tiap ketukan). */
const QUOTE_DEBOUNCE_MS = 450;

type QuoteState = { key: string; quote: SwapQuote | null };

/**
 * Kurs + biaya swap untuk pasangan & jumlah saat ini. Sementara dari data
 * tiruan dengan jeda buatan; nanti memanggil backend → LI.FI / Jupiter.
 * `loading` = kurs yang tampil belum sesuai input terakhir.
 */
export function useSwapQuote(from: SwapAsset, to: SwapAsset, amount: number) {
  const key = `${from.tokenId}>${to.tokenId}:${amount}`;
  const [state, setState] = useState<QuoteState | null>(null);

  useEffect(() => {
    if (!(amount > 0)) return;
    const timer = setTimeout(() => {
      setState({
        key,
        quote: getMockSwapQuote({
          fromSymbol: from.symbol,
          toSymbol: to.symbol,
          fromNetwork: from.network,
          toNetwork: to.network,
          amount,
        }),
      });
    }, QUOTE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [key, amount, from.symbol, from.network, to.symbol, to.network]);

  if (!(amount > 0)) return { quote: null, loading: false };
  const fresh = state?.key === key;
  return { quote: fresh ? state.quote : null, loading: !fresh };
}
