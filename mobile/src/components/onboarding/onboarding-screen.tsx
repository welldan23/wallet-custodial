import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { colors, headerGradient, sheetGradient } from '@/theme/colors';

type OnboardingScreenProps = {
  title: string;
  subtitle?: string;
  /** Langkah sekarang dari total, mis. `{ current: 1, total: 3 }`. */
  step?: { current: number; total: number };
  /** Tampilkan tombol kembali (bawaan: true kalau bisa kembali). */
  showBack?: boolean;
  children: ReactNode;
  /** Tombol aksi yang menempel di bawah layar. */
  footer?: ReactNode;
};

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/onboarding'));

/**
 * Kerangka layar onboarding (bikin/impor wallet): header teal dengan judul
 * dan indikator langkah, lembaran konten yang bisa di-scroll, dan area
 * tombol yang selalu terlihat di bawah.
 */
export function OnboardingScreen({
  title,
  subtitle,
  step,
  showBack = router.canGoBack(),
  children,
  footer,
}: OnboardingScreenProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-teal-300">
      <LinearGradient
        colors={headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { height: insets.top + 220 }]}
      />

      <View
        className="w-full max-w-[520px] self-center px-5 pb-6"
        style={{ paddingTop: insets.top + 8 }}>
        <View className="h-11 flex-row items-center justify-between">
          {showBack ? (
            <Pressable
              onPress={goBack}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t.common.back}
              className="-ml-2 h-11 w-11 items-center justify-center rounded-full active:bg-white/20">
              <Ionicons name="arrow-back" size={24} color={colors.surface} />
            </Pressable>
          ) : (
            <View className="h-11 w-11" />
          )}
          {step && (
            <View
              className="flex-row items-center gap-1.5"
              accessible
              accessibilityLabel={t.onboarding.stepLabel(step.current, step.total)}>
              {Array.from({ length: step.total }, (_, index) => (
                <View
                  key={index}
                  className={`h-1.5 rounded-full ${
                    index < step.current ? 'w-6 bg-white' : 'w-3 bg-white/40'
                  }`}
                />
              ))}
            </View>
          )}
        </View>

        <Text
          className="mt-3 text-[28px] font-bold leading-9 text-white"
          accessibilityRole="header">
          {title}
        </Text>
        {subtitle && (
          <Text className="mt-1.5 text-[15px] leading-[22px] text-white/90">{subtitle}</Text>
        )}
      </View>

      <View className="flex-1 overflow-hidden rounded-t-[28px] bg-canvas">
        <LinearGradient
          colors={sheetGradient}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { height: 360 }]}
        />
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingTop: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View className="w-full max-w-[520px] gap-4 self-center px-5">{children}</View>
        </ScrollView>

        {footer && (
          <View
            className="border-t border-line bg-surface px-5 pt-3"
            style={{ paddingBottom: insets.bottom + 12 }}>
            <View className="w-full max-w-[520px] gap-2.5 self-center">{footer}</View>
          </View>
        )}
      </View>
    </View>
  );
}

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
};

/** Tombol besar untuk area bawah onboarding. */
export function OnboardingButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
}: ActionButtonProps) {
  const primary = variant === 'primary';
  const fg = disabled ? colors.ink.faint : primary ? colors.surface : colors.primary[500];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      className={`flex-row items-center justify-center gap-2 rounded-full py-4 ${
        disabled
          ? 'bg-line'
          : primary
            ? 'bg-primary-500 active:opacity-80'
            : 'bg-primary-50 active:opacity-70'
      }`}>
      {icon && <Ionicons name={icon} size={20} color={fg} />}
      <Text
        className={`text-base font-semibold ${
          disabled ? 'text-ink-faint' : primary ? 'text-white' : 'text-primary-500'
        }`}>
        {label}
      </Text>
    </Pressable>
  );
}
