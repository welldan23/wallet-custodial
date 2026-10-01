import { useMemo } from 'react';

import type { Network } from '@/types/wallet';

import { usePortfolio } from './use-portfolio';

/** Satu aset di satu jaringan yang bisa dikirim (saldonya > 0). */
export type SendableAsset = {
  tokenId: string;
  symbol: string;
  name: string;
  isStablecoin: boolean;
  decimals: number;
  network: Network;
  amount: number;
  valueUsd: number;
};

/**
 * Semua kombinasi koin × jaringan yang punya saldo, stablecoin dulu lalu
 * urut nilai terbesar. Dipakai pemilih aset di layar Kirim.
 */
export function useSendableAssets() {
  const { portfolio, fxRates } = usePortfolio();

  const assets = useMemo(
    () =>
      [...portfolio.stablecoins, ...portfolio.gasCoins].flatMap((asset) =>
        asset.holdings.map(
          (holding): SendableAsset => ({
            tokenId: holding.tokenId,
            symbol: asset.symbol,
            name: asset.name,
            isStablecoin: asset.isStablecoin,
            decimals: holding.decimals,
            network: holding.network,
            amount: holding.amount,
            valueUsd: holding.valueUsd,
          }),
        ),
      ),
    [portfolio],
  );

  return { assets, fxRates };
}
