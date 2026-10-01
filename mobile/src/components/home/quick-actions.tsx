import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { colors } from '@/theme/colors';

export type QuickAction = 'send' | 'receive' | 'swap';

const ACTION_STYLES: Record<
  QuickAction,
  { icon: ComponentProps<typeof Ionicons>['name']; tileClassName: string; color: string }
> = {
  send: { icon: 'paper-plane', tileClassName: 'bg-tile', color: colors.primary[500] },
  receive: { icon: 'arrow-down', tileClassName: 'bg-success-50', color: colors.success[500] },
  swap: { icon: 'swap-horizontal', tileClassName: 'bg-tile', color: colors.primary[500] },
};

const ACTIONS: QuickAction[] = ['send', 'receive', 'swap'];

/** Tiga tombol utama di Home: Kirim, Terima, Swap. */
export function QuickActions({ onPress }: { onPress?: (action: QuickAction) => void }) {
  const { t } = useI18n();

  return (
    <View className="flex-row gap-3">
      {ACTIONS.map((action) => {
        const { icon, tileClassName, color } = ACTION_STYLES[action];
        return (
          <Pressable
            key={action}
            onPress={() => onPress?.(action)}
            accessibilityRole="button"
            accessibilityLabel={t.home.actions[action]}
            className={`flex-1 items-center justify-center gap-1.5 rounded-[18px] py-4 active:opacity-70 ${tileClassName}`}>
            <Ionicons name={icon} size={26} color={color} />
            <Text className="text-[13px] font-medium text-ink">{t.home.actions[action]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
