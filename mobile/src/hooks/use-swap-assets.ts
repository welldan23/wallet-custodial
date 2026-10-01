import { useMemo } from 'react';

import { MOCK_NETWORKS, MOCK_PRICES, MOCK_TOKENS } from '@/mocks/wallet';
import type { Network } from '@/types/wallet';

import { useWalletBalances } from './use-wallet-balances';

/** Satu stablecoin di satu jaringan yang bisa ditukar (saldonya boleh nol). */
export type SwapAsset = {
  tokenId: string;
  symbol: string;
  name: string;
  decimals: number;
  network: Network;
  balance: number;
  usdPrice: number;
};

/**
 * Semua stablecoin × jaringan aktif untuk Swap, yang bersaldo dulu lalu
 * urut saldo terbesar. Saldo sudah dikurangi kiriman di sesi ini.
 */
export function useSwapAssets(): SwapAsset[] {
  const balances = useWalletBalances();

  return useMemo(() => {
    const amountById = new Map(balances.map((balance) => [balance.tokenId, balance.amount]));
    return MOCK_TOKENS.filter((token) => token.isStablecoin && token.isVisible)
      .flatMap((token): SwapAsset[] => {
        const network = MOCK_NETWORKS.find((item) => item.id === token.networkId);
        if (!network?.isActive) return [];
        return [
          {
            tokenId: token.id,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            network,
            balance: amountById.get(token.id) ?? 0,
            usdPrice: MOCK_PRICES.find((price) => price.symbol === token.symbol)?.usdPrice ?? 0,
          },
        ];
      })
      .sort((a, b) => b.balance - a.balance);
  }, [balances]);
}

/**
 * Pasangan awal: koin asal = saldo terbesar, tujuan = stablecoin lain di
 * jaringan yang sama (swap paling murah, tanpa bridge).
 */
export function defaultSwapPair(assets: SwapAsset[]) {
  const from = assets.find((asset) => asset.balance > 0) ?? assets[0];
  if (!from) return null;
  const to =
    assets.find((asset) => asset.network.id === from.network.id && asset.symbol !== from.symbol) ??
    assets.find((asset) => asset.symbol !== from.symbol) ??
    null;
  return to ? { from, to } : null;
}
