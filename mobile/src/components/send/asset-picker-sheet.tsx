import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { TokenNetworkIcon } from '@/components/crypto/token-network-icon';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import type { SendableAsset } from '@/hooks/use-sendable-assets';
import { useFormat } from '@/hooks/use-format';
import { useI18n } from '@/i18n';
import { MASKED_VALUE } from '@/lib/format';
import { useThemeColors } from '@/hooks/use-theme';
import type { FiatCurrency, FxRates } from '@/types/wallet';

type AssetPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  assets: SendableAsset[];
  selectedTokenId: string | null;
  onSelect: (tokenId: string) => void;
  currency: FiatCurrency;
  fxRates: FxRates;
  hidden: boolean;
};

/** Cocokkan kata kunci ke simbol, nama token, atau nama jaringan. */
export function matchesAssetQuery(asset: SendableAsset, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [asset.symbol, asset.name, asset.network.name].some((text) =>
    text.toLowerCase().includes(q),
  );
}

/** Lembar "Pilih Aset": tiap koin × jaringan dengan saldonya, bisa dicari. */
export function AssetPickerSheet({
  visible,
  onClose,
  assets,
  selectedTokenId,
  onSelect,
  currency,
  fxRates,
  hidden,
}: AssetPickerSheetProps) {
  const colors = useThemeColors();
  const { formatFiat, formatTokenAmount } = useFormat();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const filtered = assets.filter((asset) => matchesAssetQuery(asset, query));

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={close} title={t.send.pickAssetTitle}>
      <View className="mb-2 flex-row items-center gap-2 rounded-full bg-subtle px-4 py-2.5">
        <Ionicons name="search" size={18} color={colors.ink.faint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.send.searchAsset}
          placeholderTextColor={colors.ink.faint}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={t.send.searchAsset}
          className="flex-1 text-[15px] text-ink"
          style={{ outlineStyle: 'none' } as object}
        />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" accessibilityRole="radiogroup">
        {filtered.length === 0 && (
          <Text className="py-8 text-center text-sm text-ink-muted">{t.send.noAssetFound}</Text>
        )}
        {filtered.map((asset, index) => {
          const selected = asset.tokenId === selectedTokenId;
          return (
            <Pressable
              key={asset.tokenId}
              onPress={() => {
                onSelect(asset.tokenId);
                close();
              }}
              accessibilityRole="radio"
              aria-checked={selected}
              accessibilityLabel={`${asset.symbol} ${asset.network.name}`}
              className={`flex-row items-center gap-3 py-3 active:opacity-70 ${
                index === filtered.length - 1 ? '' : 'border-b border-line'
              }`}>
              <TokenNetworkIcon symbol={asset.symbol} networkId={asset.network.id} size={38} />
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-ink">{asset.symbol}</Text>
                <Text className="text-xs text-ink-muted">{asset.network.name}</Text>
              </View>
              <View className="items-end">
                <Text className="text-sm font-semibold text-ink">
                  {hidden ? MASKED_VALUE : formatTokenAmount(asset.amount, asset.isStablecoin)}
                </Text>
                <Text className="text-[11px] text-ink-muted">
                  ≈ {hidden ? MASKED_VALUE : formatFiat(asset.valueUsd, currency, fxRates)}
                </Text>
              </View>
              {selected ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.primary[500]} />
              ) : (
                <View className="h-5 w-5 rounded-full border-2 border-line" />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}
