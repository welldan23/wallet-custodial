import { Text, View } from 'react-native';

import { NetworkBadges } from '@/components/crypto/network-badges';
import { TokenIcon } from '@/components/crypto/token-icon';
import { formatFiat, formatTokenAmount, MASKED_VALUE } from '@/lib/format';
import type { PortfolioAsset } from '@/lib/portfolio';
import type { FiatCurrency, FxRates } from '@/types/wallet';

type AssetRowProps = {
  asset: PortfolioAsset;
  currency: FiatCurrency;
  fxRates: FxRates;
  hidden: boolean;
  isLast: boolean;
};

/** Satu baris aset: logo, simbol + jaringan, jumlah token + nilai fiat. */
export function AssetRow({ asset, currency, fxRates, hidden, isLast }: AssetRowProps) {
  return (
    <View className={`flex-row items-center gap-3 py-3 ${isLast ? '' : 'border-b border-line'}`}>
      <TokenIcon symbol={asset.symbol} size={44} />

      <View className="flex-1 gap-1">
        <Text className="text-base font-bold text-ink">{asset.symbol}</Text>
        <NetworkBadges networks={asset.holdings.map((holding) => holding.network)} />
      </View>

      <View className="items-end gap-0.5">
        <Text className="text-[15px] font-bold text-ink" style={{ fontVariant: ['tabular-nums'] }}>
          {hidden ? MASKED_VALUE : formatTokenAmount(asset.amount, asset.isStablecoin)}
        </Text>
        <Text className="text-xs text-ink-muted" style={{ fontVariant: ['tabular-nums'] }}>
          ≈ {hidden ? MASKED_VALUE : formatFiat(asset.valueUsd, currency, fxRates)}
        </Text>
      </View>
    </View>
  );
}
