import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { colors, stackGradient } from '@/theme/colors';

type StackScreenProps = {
  title: string;
  children: ReactNode;
};

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Kerangka halaman di atas tab (Kirim, Terima, Swap): tombol kembali + judul di tengah. */
export function StackScreen({ title, children }: StackScreenProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-canvas">
      <LinearGradient
        colors={stackGradient}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { height: 320 }]}
      />

      <View
        className="w-full max-w-[520px] flex-row items-center self-center px-2 pb-2"
        style={{ paddingTop: insets.top + 6 }}>
        <Pressable
          onPress={goBack}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t.common.back}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-black/5">
          <Ionicons name="arrow-back" size={24} color={colors.ink.DEFAULT} />
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

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        <View className="w-full max-w-[520px] gap-4 self-center px-4">{children}</View>
      </ScrollView>
    </View>
  );
}
