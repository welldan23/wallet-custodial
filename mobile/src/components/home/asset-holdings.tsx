import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { useFormat } from '@/hooks/use-format';
import { useI18n } from '@/i18n';
import { formatPercent, MASKED_VALUE } from '@/lib/format';
import type { PortfolioAsset } from '@/lib/portfolio';
import type { FiatCurrency, FxRates } from '@/types/wallet';

type AssetHoldingsProps = {
  asset: PortfolioAsset;
  currency: FiatCurrency;
  fxRates: FxRates;
  hidden: boolean;
};

const tabularNums = { fontVariant: ['tabular-nums' as const] };

/** Rincian satu aset per jaringan: logo + nama jaringan, porsi, jumlah, dan nilai fiat. */
export function AssetHoldings({ asset, currency, fxRates, hidden }: AssetHoldingsProps) {
  const { formatFiat, formatTokenAmount } = useFormat();
  const { t } = useI18n();

  return (
    <Animated.View entering={FadeIn.duration(180)}>
      <View className="mb-3 rounded-2xl bg-subtle px-3 py-1">
        {asset.holdings.map((holding, index) => (
          <View
            key={holding.network.id}
            className={`flex-row items-center gap-2.5 py-2.5 ${
              index === asset.holdings.length - 1 ? '' : 'border-b border-line'
            }`}>
            <NetworkIcon networkId={holding.network.id} size={24} />

            <View className="flex-1">
              <Text className="text-[13px] font-semibold text-ink">{holding.network.name}</Text>
              <Text className="text-[11px] text-ink-muted">
                {t.home.holdingShare(formatPercent(holding.share), asset.symbol)}
              </Text>
            </View>

            <View className="items-end">
              <Text className="text-[13px] font-semibold text-ink" style={tabularNums}>
                {hidden
                  ? MASKED_VALUE
                  : `${formatTokenAmount(holding.amount, asset.isStablecoin)} ${asset.symbol}`}
              </Text>
              <Text className="text-[11px] text-ink-muted" style={tabularNums}>
                ≈ {hidden ? MASKED_VALUE : formatFiat(holding.valueUsd, currency, fxRates)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}
