import { Pressable, Text, TextInput, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { TokenNetworkIcon } from '@/components/crypto/token-network-icon';
import type { SwapAsset } from '@/hooks/use-swap-assets';
import { useI18n } from '@/i18n';
import { formatTokenAmount, MASKED_VALUE } from '@/lib/format';
import { cardShadow, colors } from '@/theme/colors';

type SwapAssetCardProps = {
  label: string;
  asset: SwapAsset;
  hidden: boolean;
  /** Teks di bawah angka, mis. `≈ Rp 16.350` atau pesan error. */
  caption: string;
  captionIsError?: boolean;
} & (
  | { editable: true; value: string; onChange: (value: string) => void; onMax: () => void }
  | { editable: false; value: string }
);

const tabularNums = { fontVariant: ['tabular-nums' as const] };

/** Kartu "Dari" (bisa diketik) atau "Ke" (hasil perkiraan) di layar Swap. */
export function SwapAssetCard(props: SwapAssetCardProps) {
  const { t } = useI18n();
  const { label, asset, hidden, caption, captionIsError } = props;
  const balance = hidden ? MASKED_VALUE : formatTokenAmount(asset.balance, true);

  return (
    <View className="rounded-[20px] bg-surface px-4 py-3.5" style={cardShadow}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[13px] font-semibold text-ink-muted">{label}</Text>
        <Text className="text-xs text-ink-muted" style={tabularNums}>
          {t.swap.balance(balance, asset.symbol)}
        </Text>
      </View>

      <View className="mt-2.5 flex-row items-center gap-3">
        <View
          className="flex-row items-center gap-2.5 rounded-2xl bg-subtle py-2 pl-2 pr-3"
          accessible
          accessibilityLabel={t.swap.assetLabel(label, asset.symbol, asset.network.name)}>
          <TokenNetworkIcon symbol={asset.symbol} networkId={asset.network.id} size={34} />
          <View>
            <Text className="text-[15px] font-bold text-ink">{asset.symbol}</Text>
            <View className="flex-row items-center gap-1">
              <NetworkIcon networkId={asset.network.id} size={11} />
              <Text className="text-[11px] font-semibold text-ink-soft">{asset.network.name}</Text>
            </View>
          </View>
        </View>

        {props.editable ? (
          <TextInput
            value={props.value}
            onChangeText={props.onChange}
            placeholder="0"
            placeholderTextColor={colors.ink.faint}
            keyboardType="decimal-pad"
            inputMode="decimal"
            accessibilityLabel={t.swap.amountLabel}
            className="min-h-[48px] min-w-0 flex-1 text-right text-[26px] font-bold text-ink"
            style={[tabularNums, { outlineStyle: 'none' } as object]}
          />
        ) : (
          <Text
            className={`min-w-0 flex-1 text-right text-[26px] font-bold ${
              props.value ? 'text-ink' : 'text-ink-faint'
            }`}
            style={tabularNums}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={t.swap.estimatedLabel(props.value || '0', asset.symbol)}>
            {props.value || '0'}
          </Text>
        )}
      </View>

      <View className="mt-2 flex-row items-center justify-between gap-2">
        {props.editable ? (
          <Pressable
            onPress={props.onMax}
            accessibilityRole="button"
            accessibilityLabel={t.swap.maxLabel}
            className="rounded-full bg-primary-50 px-3 py-1 active:opacity-70">
            <Text className="text-xs font-bold text-primary-500">{t.send.max}</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Text
          className={`flex-1 text-right text-xs ${captionIsError ? 'text-danger-600' : 'text-ink-muted'}`}
          style={tabularNums}>
          {caption}
        </Text>
      </View>
    </View>
  );
}
