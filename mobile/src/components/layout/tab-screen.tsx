import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/use-theme';
import { themeGradients } from '@/theme/colors';

import { TopNavPills, type TopNavKey } from './top-nav-pills';

type TabScreenProps = {
  /** Pil yang aktif di header. `null` = header tanpa menu pil (mis. Profile). */
  active: TopNavKey | null;
  /** Judul besar di awal lembaran, mis. "Tracker". */
  title?: string;
  children: ReactNode;
};

/**
 * Kerangka layar tab: header teal + menu pil, lalu lembaran konten
 * bersudut melengkung yang bisa di-scroll.
 */
export function TabScreen({ active, title, children }: TabScreenProps) {
  const colors = useThemeColors();
  const gradients = themeGradients(colors);
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-teal-300">
      <LinearGradient
        colors={gradients.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { height: insets.top + 180 }]}
      />

      <View
        className="w-full max-w-[520px] self-center px-4 pb-4"
        style={{ paddingTop: insets.top + 10 }}>
        {active && <TopNavPills active={active} />}
      </View>

      <View className="flex-1 overflow-hidden rounded-t-[28px] bg-canvas">
        <LinearGradient
          colors={gradients.sheet}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { height: 360 }]}
        />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}>
          <View className="w-full max-w-[520px] gap-4 self-center px-4">
            {title && <Text className="text-[28px] font-bold text-ink">{title}</Text>}
            {children}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
