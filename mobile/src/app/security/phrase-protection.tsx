import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';

import { StackScreen } from '@/components/layout/stack-screen';
import { useThemeColors } from '@/hooks/use-theme';
import { useWallet } from '@/hooks/use-wallet';
import { useI18n } from '@/i18n';
import { cardShadow } from '@/theme/colors';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Penjelasan cara MyWallet melindungi 12 kata, plus status di HP ini. */
export default function PhraseProtectionScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const copy = t.phraseProtection;
  const wallet = useWallet();

  // Status nyata di HP ini (bukan janji umum).
  const statusRows: { ok: boolean; label: string }[] =
    wallet.status === 'ready'
      ? [
          {
            ok: wallet.persistent,
            label: wallet.persistent ? copy.status.stored : copy.status.notStored,
          },
          {
            ok: wallet.biometricBound,
            label: wallet.biometricBound ? copy.status.biometric : copy.status.noBiometric,
          },
        ]
      : [{ ok: false, label: copy.status.noWallet }];

  const protections: { icon: IconName; title: string; body: string }[] = [
    { icon: 'phone-portrait-outline', title: copy.onDevice.title, body: copy.onDevice.body },
    { icon: 'finger-print', title: copy.biometric.title, body: copy.biometric.body },
    { icon: 'cloud-offline-outline', title: copy.neverSent.title, body: copy.neverSent.body },
    { icon: 'eye-off-outline', title: copy.screen.title, body: copy.screen.body },
    { icon: 'clipboard-outline', title: copy.clipboard.title, body: copy.clipboard.body },
  ];

  return (
    <StackScreen title={copy.title}>
      <View className="items-center gap-2 px-2 pt-2">
        <View className="h-16 w-16 items-center justify-center rounded-[22px] bg-primary-50">
          <Ionicons name="shield-checkmark" size={32} color={colors.primary[500]} />
        </View>
        <Text className="text-center text-xl font-bold text-ink">{copy.headline}</Text>
        <Text className="text-center text-sm leading-5 text-ink-muted">{copy.intro}</Text>
      </View>

      <View className="gap-2 rounded-[20px] bg-surface p-4" style={cardShadow}>
        <Text className="text-[13px] font-semibold text-ink-muted" accessibilityRole="header">
          {copy.status.title}
        </Text>
        {statusRows.map((row) => (
          <View key={row.label} className="flex-row items-start gap-2">
            <Ionicons
              name={row.ok ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={row.ok ? colors.success[500] : colors.warning[500]}
            />
            <Text className="flex-1 text-[13px] leading-5 text-ink-soft">{row.label}</Text>
          </View>
        ))}
      </View>

      <View className="rounded-[20px] bg-surface px-4" style={cardShadow}>
        {protections.map((item, index) => (
          <View
            key={item.title}
            className={`flex-row gap-3 py-3.5 ${index === protections.length - 1 ? '' : 'border-b border-line'}`}>
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary-50">
              <Ionicons name={item.icon} size={18} color={colors.primary[500]} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-[15px] font-semibold text-ink">{item.title}</Text>
              <Text className="text-[13px] leading-5 text-ink-muted">{item.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="gap-3 rounded-[20px] border border-warning-500/40 bg-warning-50 p-4">
        <View className="flex-row items-center gap-2">
          <Ionicons name="warning" size={18} color={colors.warning[600]} />
          <Text className="flex-1 text-sm font-bold text-warning-600" accessibilityRole="header">
            {copy.yourPart.title}
          </Text>
        </View>
        {copy.yourPart.items.map((item) => (
          <View key={item} className="flex-row items-start gap-2">
            <Text className="text-[13px] leading-5 text-ink-soft">•</Text>
            <Text className="flex-1 text-[13px] leading-5 text-ink-soft">{item}</Text>
          </View>
        ))}
      </View>

      <View className="gap-2 rounded-[20px] bg-surface p-4" style={cardShadow}>
        <Text className="text-[15px] font-semibold text-ink" accessibilityRole="header">
          {copy.lostPhone.title}
        </Text>
        <Text className="text-[13px] leading-5 text-ink-muted">{copy.lostPhone.body}</Text>
      </View>
    </StackScreen>
  );
}
