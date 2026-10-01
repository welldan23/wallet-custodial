import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { colors } from '@/theme/colors';

import { NetworkOptionList } from './network-option-list';
import type { NetworkPickerProps } from './types';

type NetworkPickerSheetProps = NetworkPickerProps & {
  visible: boolean;
  onClose: () => void;
  title?: string;
};

/** Lembar bawah "Pilih Jaringan". Memilih jaringan langsung menutup lembar. */
export function NetworkPickerSheet({
  visible,
  onClose,
  title,
  onSelect,
  ...listProps
}: NetworkPickerSheetProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Animated.View entering={FadeIn.duration(150)} style={StyleSheet.absoluteFill}>
          <Pressable
            className="flex-1 bg-black/40"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t.common.close}
          />
        </Animated.View>

        <Animated.View entering={SlideInDown.duration(220)} accessibilityViewIsModal>
          <View
            className="w-full max-w-[520px] self-center rounded-t-[28px] bg-surface px-5 pt-2"
            style={{ paddingBottom: insets.bottom + 16 }}>
            <View className="mb-1 h-1 w-10 self-center rounded-full bg-line" />
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-lg font-bold text-ink" accessibilityRole="header">
                {title ?? t.networkPicker.title}
              </Text>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t.common.close}
                className="h-9 w-9 items-center justify-center rounded-full bg-subtle active:opacity-70">
                <Ionicons name="close" size={20} color={colors.ink.soft} />
              </Pressable>
            </View>
            <NetworkOptionList
              {...listProps}
              onSelect={(networkId) => {
                onSelect(networkId);
                onClose();
              }}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
