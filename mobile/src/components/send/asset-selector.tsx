import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { TokenNetworkIcon } from '@/components/crypto/token-network-icon';
import type { SendableAsset } from '@/hooks/use-sendable-assets';
import { useI18n } from '@/i18n';
import { formatFiat, formatTokenAmount, MASKED_VALUE } from '@/lib/format';
import { cardShadow, colors } from '@/theme/colors';
import type { FiatCurrency, FxRates } from '@/types/wallet';

type AssetSelectorProps = {
  asset: SendableAsset;
  onPress: () => void;
  currency: FiatCurrency;
  fxRates: FxRates;
  hidden: boolean;
};

/** Kartu aset terpilih (koin + jaringan + saldo); ketuk untuk ganti. */
export function AssetSelector({ asset, onPress, currency, fxRates, hidden }: AssetSelectorProps) {
  const { t } = useI18n();
  const balance = hidden ? MASKED_VALUE : formatTokenAmount(asset.amount, asset.isStablecoin);

  return (
    <View className="rounded-[20px] bg-surface px-4 py-3.5" style={cardShadow}>
      <Text className="mb-2 text-[13px] font-semibold text-ink-muted">{t.send.assetLabel}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t.send.changeAssetLabel(asset.symbol, asset.network.name)}
        className="flex-row items-center gap-3 active:opacity-70">
        <TokenNetworkIcon symbol={asset.symbol} networkId={asset.network.id} size={42} />
        <View className="flex-1 gap-1">
          <Text className="text-base font-bold text-ink">{asset.symbol}</Text>
          <View className="flex-row items-center gap-1.5 self-start rounded-full bg-subtle px-2 py-0.5">
            <NetworkIcon networkId={asset.network.id} size={14} />
            <Text className="text-xs font-semibold text-ink-soft">{asset.network.name}</Text>
          </View>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.ink.muted} />
      </Pressable>
      <View className="mt-3 flex-row items-center justify-between border-t border-line pt-3">
        <Text className="text-xs text-ink-muted">{t.send.available}</Text>
        <Text className="text-xs font-semibold text-ink">
          {balance} {asset.symbol}
          <Text className="font-normal text-ink-muted">
            {'  '}≈ {hidden ? MASKED_VALUE : formatFiat(asset.valueUsd, currency, fxRates)}
          </Text>
        </Text>
      </View>
    </View>
  );
}
