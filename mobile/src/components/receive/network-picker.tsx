import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import type { SupportedNetwork } from '@/hooks/use-supported-networks';
import { useI18n } from '@/i18n';
import { cardShadow, colors } from '@/theme/colors';
import type { NetworkId } from '@/types/wallet';

type NetworkPickerProps = {
  items: SupportedNetwork[];
  selectedId: NetworkId | null;
  onSelect: (networkId: NetworkId) => void;
};

/** Daftar besar pilihan jaringan — dipakai sebelum jaringan dipilih. */
export function NetworkList({ items, selectedId, onSelect }: NetworkPickerProps) {
  const { t } = useI18n();

  return (
    <View className="rounded-[20px] bg-surface px-4 pb-1 pt-4" style={cardShadow}>
      <Text className="text-lg font-bold text-ink">{t.receive.chooseNetworkTitle}</Text>
      <Text className="mt-0.5 text-[13px] text-ink-muted">{t.receive.chooseNetworkSubtitle}</Text>

      <View className="mt-2" accessibilityRole="radiogroup">
        {items.map(({ network, symbols }, index) => {
          const selected = network.id === selectedId;
          return (
            <Pressable
              key={network.id}
              onPress={() => onSelect(network.id)}
              accessibilityRole="radio"
              aria-checked={selected}
              accessibilityLabel={`${network.name}, ${t.receive.supportedAssets(symbols.join(', '))}`}
              className={`flex-row items-center gap-3 py-3 active:opacity-70 ${
                index === items.length - 1 ? '' : 'border-b border-line'
              }`}>
              <NetworkIcon networkId={network.id} size={34} />
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-ink">{network.name}</Text>
                <Text className="text-xs text-ink-muted">
                  {t.receive.supportedAssets(symbols.join(' · '))}
                </Text>
              </View>
              {selected ? (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
              ) : (
                <View className="h-[22px] w-[22px] rounded-full border-2 border-line" />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Versi ringkas (chip) untuk ganti jaringan setelah alamat tampil. */
export function NetworkChips({ items, selectedId, onSelect }: NetworkPickerProps) {
  const { t } = useI18n();

  return (
    <View className="gap-2">
      <Text className="text-[13px] font-semibold text-ink-muted">{t.receive.networkLabel}</Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {items.map(({ network }) => {
          const selected = network.id === selectedId;
          return (
            <Pressable
              key={network.id}
              onPress={() => onSelect(network.id)}
              accessibilityRole="radio"
              aria-checked={selected}
              accessibilityLabel={network.name}
              className={`flex-row items-center gap-1.5 rounded-full border px-3 py-2 active:opacity-70 ${
                selected ? 'border-primary-500 bg-primary-50' : 'border-line bg-surface'
              }`}>
              <NetworkIcon networkId={network.id} size={18} />
              <Text
                className={`text-[13px] font-semibold ${selected ? 'text-primary-600' : 'text-ink-soft'}`}>
                {network.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
