import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { useThemeColors } from '@/hooks/use-theme';

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** Lembar dari bawah layar dengan judul + tombol tutup; ketuk latar untuk menutup. */
export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const colors = useThemeColors();
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

        <Animated.View
          entering={SlideInDown.duration(220)}
          accessibilityViewIsModal
          style={{ maxHeight: '88%' }}>
          <View
            className="w-full max-w-[520px] self-center rounded-t-[28px] bg-surface px-5 pt-2"
            style={{ paddingBottom: insets.bottom + 16, maxHeight: '100%' }}>
            <View className="mb-1 h-1 w-10 self-center rounded-full bg-line" />
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-lg font-bold text-ink" accessibilityRole="header">
                {title}
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
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
