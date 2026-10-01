import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { useI18n } from '@/i18n';

import { NetworkPickerSheet } from './network-picker-sheet';
import type { NetworkOption, NetworkPickerProps } from './types';

type NetworkChipsProps = NetworkPickerProps & {
  label?: string;
  /** Jumlah chip sebelum sisanya diringkas jadi "+N" (membuka lembar pilihan). */
  maxVisible?: number;
};

/** Pilih chip yang tampil: jaringan terpilih selalu ikut terlihat. */
export function visibleNetworkOptions(
  options: NetworkOption[],
  selectedId: string | null,
  maxVisible: number,
): NetworkOption[] {
  if (options.length <= maxVisible) return options;
  const visible = options.slice(0, maxVisible);
  const selected = options.find((option) => option.network.id === selectedId);
  if (selected && !visible.includes(selected)) visible[maxVisible - 1] = selected;
  return visible;
}

/** Chip jaringan untuk ganti cepat; jaringan sisanya lewat chip "+N". */
export function NetworkChips({ label, maxVisible = 4, ...pickerProps }: NetworkChipsProps) {
  const { t } = useI18n();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { options, selectedId, onSelect } = pickerProps;
  const visible = visibleNetworkOptions(options, selectedId, maxVisible);
  const hiddenCount = options.length - visible.length;

  return (
    <View className="gap-2">
      {label && <Text className="text-[13px] font-semibold text-ink-muted">{label}</Text>}
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {visible.map(({ network }) => {
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
        {hiddenCount > 0 && (
          <Pressable
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t.networkPicker.moreLabel(hiddenCount)}
            className="items-center justify-center rounded-full border border-line bg-surface px-3.5 py-2 active:opacity-70">
            <Text className="text-[13px] font-semibold text-ink-soft">+{hiddenCount}</Text>
          </Pressable>
        )}
      </View>

      <NetworkPickerSheet
        {...pickerProps}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}
