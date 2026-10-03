import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { useThemeColors } from '@/hooks/use-theme';
import { themeGradients } from '@/theme/colors';

type StackScreenProps = {
  title: string;
  children: ReactNode;
  /** Ganti aksi tombol kembali (bawaan: halaman sebelumnya). */
  onBack?: () => void;
};

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * Kerangka halaman di atas tab (Kirim, Terima, Swap, …): header teal yang sama
 * dengan layar tab, tombol kembali + judul di tengah, lalu lembaran konten.
 */
export function StackScreen({ title, children, onBack = goBack }: StackScreenProps) {
  const colors = useThemeColors();
  const gradients = themeGradients(colors);
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-teal-300">
      <LinearGradient
        colors={gradients.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { height: insets.top + 160 }]}
      />

      <View
        className="w-full max-w-[520px] flex-row items-center self-center px-3 pb-3"
        style={{ paddingTop: insets.top + 8 }}>
        <Pressable
          onPress={onBack}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t.common.back}
          className="h-11 w-11 items-center justify-center rounded-full bg-white/30 active:opacity-70">
          <Ionicons name="arrow-back" size={22} color={colors.ink.DEFAULT} />
        </Pressable>
        <Text
          className="flex-1 text-center text-lg font-bold text-ink"
          accessibilityRole="header"
          numberOfLines={1}>
          {title}
        </Text>
        {/* Penyeimbang supaya judul tetap di tengah */}
        <View className="h-11 w-11" />
      </View>

      <View className="flex-1 overflow-hidden rounded-t-[28px] bg-canvas">
        <LinearGradient
          colors={gradients.sheet}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { height: 360 }]}
        />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}>
          <View className="w-full max-w-[520px] gap-4 self-center px-4">{children}</View>
        </ScrollView>
      </View>
    </View>
  );
}
