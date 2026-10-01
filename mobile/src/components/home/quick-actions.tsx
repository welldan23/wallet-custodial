import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { cardShadow, colors } from '@/theme/colors';

export type QuickAction = 'send' | 'receive' | 'swap';

const ACTION_ICONS: Record<QuickAction, ComponentProps<typeof Ionicons>['name']> = {
  send: 'paper-plane-outline',
  receive: 'arrow-down',
  swap: 'swap-horizontal',
};

const ACTIONS: QuickAction[] = ['send', 'receive', 'swap'];

/** Tiga tombol utama di Home: Kirim, Terima, Swap. */
export function QuickActions({ onPress }: { onPress?: (action: QuickAction) => void }) {
  const { t } = useI18n();

  return (
    <View className="flex-row gap-3">
      {ACTIONS.map((action) => (
        <Pressable
          key={action}
          onPress={() => onPress?.(action)}
          accessibilityRole="button"
          className="flex-1 items-center gap-2 rounded-2xl bg-surface py-3 active:opacity-70"
          style={cardShadow}>
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-50">
            <Ionicons name={ACTION_ICONS[action]} size={20} color={colors.brand[600]} />
          </View>
          <Text className="text-[13px] font-semibold text-ink">{t.home.actions[action]}</Text>
        </Pressable>
      ))}
    </View>
  );
}
