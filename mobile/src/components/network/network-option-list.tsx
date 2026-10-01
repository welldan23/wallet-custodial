import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { colors } from '@/theme/colors';

import type { NetworkPickerProps } from './types';

/** Daftar jaringan bergaya radio: logo, nama, keterangan, tanda pilih. */
export function NetworkOptionList({ options, selectedId, onSelect }: NetworkPickerProps) {
  return (
    <View accessibilityRole="radiogroup">
      {options.map(({ network, description }, index) => {
        const selected = network.id === selectedId;
        return (
          <Pressable
            key={network.id}
            onPress={() => onSelect(network.id)}
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityLabel={description ? `${network.name}, ${description}` : network.name}
            className={`flex-row items-center gap-3 py-3 active:opacity-70 ${
              index === options.length - 1 ? '' : 'border-b border-line'
            }`}>
            <NetworkIcon networkId={network.id} size={34} />
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-ink">{network.name}</Text>
              {description && <Text className="text-xs text-ink-muted">{description}</Text>}
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
  );
}
