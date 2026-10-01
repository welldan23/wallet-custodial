import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { NetworkBadges } from '@/components/crypto/network-badges';
import { TokenIcon } from '@/components/crypto/token-icon';
import { useI18n } from '@/i18n';
import { formatFiat, formatTokenAmount, MASKED_VALUE } from '@/lib/format';
import type { PortfolioAsset } from '@/lib/portfolio';
import { colors } from '@/theme/colors';
import type { FiatCurrency, FxRates } from '@/types/wallet';

import { AssetHoldings } from './asset-holdings';

type AssetRowProps = {
  asset: PortfolioAsset;
  currency: FiatCurrency;
  fxRates: FxRates;
  hidden: boolean;
  isLast: boolean;
};

const tabularNums = { fontVariant: ['tabular-nums' as const] };

/**
 * Satu baris aset: logo, simbol + jaringan, jumlah token + nilai fiat.
 * Ketuk baris untuk membuka rincian saldo per jaringan.
 */
export function AssetRow({ asset, currency, fxRates, hidden, isLast }: AssetRowProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const networks = asset.holdings.map((holding) => holding.network);

  return (
    <View className={isLast ? '' : 'border-b border-line'}>
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        aria-expanded={expanded}
        accessibilityLabel={`${asset.symbol}, ${t.home.networkCount(networks.length)}`}
        accessibilityHint={expanded ? t.home.hideBreakdown : t.home.showBreakdown}
        className="flex-row items-center gap-3 py-3 active:opacity-70">
        <TokenIcon symbol={asset.symbol} size={44} />

        <View className="flex-1 gap-1">
          <Text className="text-base font-bold text-ink">{asset.symbol}</Text>
          <NetworkBadges networks={networks} />
        </View>

        <View className="items-end gap-0.5">
          <Text className="text-base font-bold text-ink" style={tabularNums}>
            {hidden ? MASKED_VALUE : formatTokenAmount(asset.amount, asset.isStablecoin)}
          </Text>
          <Text className="text-xs text-ink-muted" style={tabularNums}>
            ≈ {hidden ? MASKED_VALUE : formatFiat(asset.valueUsd, currency, fxRates)}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.ink.faint}
          style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
        />
      </Pressable>

      {expanded && (
        <AssetHoldings asset={asset} currency={currency} fxRates={fxRates} hidden={hidden} />
      )}
    </View>
  );
}
