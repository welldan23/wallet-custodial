import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { TokenIcon } from '@/components/crypto/token-icon';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import type { SwapAsset } from '@/hooks/use-swap-assets';
import { useFormat } from '@/hooks/use-format';
import { useI18n } from '@/i18n';
import { MASKED_VALUE } from '@/lib/format';
import { useThemeColors } from '@/hooks/use-theme';
import type { NetworkId } from '@/types/wallet';

export type SwapSide = 'from' | 'to';

type SwapAssetPickerSheetProps = {
  side: SwapSide | null;
  onClose: () => void;
  assets: SwapAsset[];
  selected: SwapAsset;
  /** Jaringan koin di sisi seberang — dipakai menandai rute yang perlu bridge. */
  otherNetworkId: NetworkId;
  /** Koin di sisi seberang; memilihnya = tukar arah. */
  otherTokenId: string;
  hidden: boolean;
  onSelect: (tokenId: string) => void;
};

/**
 * Lembar pilih koin Swap: pilih koin (USDC/USDT) lalu jaringannya.
 * Sisi "Dari" hanya bisa memilih jaringan yang ada saldonya; sisi "Ke"
 * menandai jaringan berbeda karena butuh bridge (lebih lama & mahal).
 */
export function SwapAssetPickerSheet({
  side,
  onClose,
  assets,
  selected,
  otherNetworkId,
  otherTokenId,
  hidden,
  onSelect,
}: SwapAssetPickerSheetProps) {
  const colors = useThemeColors();
  const { formatTokenAmount } = useFormat();
  const { t } = useI18n();
  const symbols = [...new Set(assets.map((asset) => asset.symbol))].sort();
  // Mulai dari koin yang sedang terpilih; induk memberi `key` per sisi
  // supaya pilihan tab ini direset tiap kali lembar dibuka.
  const [symbol, setSymbol] = useState(selected.symbol);

  const options = assets
    .filter((asset) => asset.symbol === symbol)
    .sort((a, b) => b.balance - a.balance || a.network.name.localeCompare(b.network.name));

  return (
    <BottomSheet
      visible={side !== null}
      onClose={onClose}
      title={side === 'to' ? t.swap.pickToTitle : t.swap.pickFromTitle}>
      <View className="mb-3 flex-row gap-2" accessibilityRole="tablist">
        {symbols.map((item) => {
          const active = item === symbol;
          return (
            <Pressable
              key={item}
              onPress={() => setSymbol(item)}
              accessibilityRole="tab"
              aria-selected={active}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-full py-2.5 active:opacity-70 ${
                active ? 'bg-primary-500' : 'bg-subtle'
              }`}>
              <TokenIcon symbol={item} size={20} />
              <Text className={`text-sm font-bold ${active ? 'text-white' : 'text-ink-soft'}`}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="mb-1 text-xs font-semibold text-ink-muted">{t.swap.pickNetwork}</Text>
      <ScrollView accessibilityRole="radiogroup">
        {options.map((asset, index) => {
          const isSelected = asset.tokenId === selected.tokenId;
          const empty = side === 'from' && asset.balance <= 0;
          const isOther = asset.tokenId === otherTokenId;
          const needsBridge = side === 'to' && !isOther && asset.network.id !== otherNetworkId;
          return (
            <Pressable
              key={asset.tokenId}
              disabled={empty}
              onPress={() => {
                onSelect(asset.tokenId);
                onClose();
              }}
              accessibilityRole="radio"
              aria-checked={isSelected}
              aria-disabled={empty}
              accessibilityLabel={[
                `${asset.symbol} ${asset.network.name}`,
                empty ? t.swap.emptyBalance : null,
                isOther ? t.swap.flipNote : null,
                needsBridge ? t.swap.bridgeNote : null,
              ]
                .filter(Boolean)
                .join(', ')}
              className={`flex-row items-center gap-3 py-3 active:opacity-70 ${
                index === options.length - 1 ? '' : 'border-b border-line'
              } ${empty ? 'opacity-45' : ''}`}>
              <NetworkIcon networkId={asset.network.id} size={34} />
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-semibold text-ink">{asset.network.name}</Text>
                {isOther ? (
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="swap-vertical" size={12} color={colors.primary[500]} />
                    <Text className="text-[11px] font-semibold text-primary-500">
                      {t.swap.flipNote}
                    </Text>
                  </View>
                ) : needsBridge ? (
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="git-compare-outline" size={12} color={colors.warning[600]} />
                    <Text className="text-[11px] font-semibold text-warning-600">
                      {t.swap.bridgeNote}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-xs text-ink-muted">
                    {empty
                      ? t.swap.emptyBalance
                      : t.swap.balance(
                          hidden ? MASKED_VALUE : formatTokenAmount(asset.balance, true),
                          asset.symbol,
                        )}
                  </Text>
                )}
              </View>
              {isSelected ? (
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
