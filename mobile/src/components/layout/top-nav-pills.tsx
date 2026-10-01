import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { colors } from '@/theme/colors';

export type TopNavKey = 'history' | 'home' | 'portfolio';

const ITEMS: { key: TopNavKey; href: Href; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'history', href: '/history', icon: 'pie-chart' },
  { key: 'home', href: '/', icon: 'home' },
  { key: 'portfolio', href: '/portfolio', icon: 'wallet' },
];

/** Menu pil di header teal: Tracker | Home | Portfolio. */
export function TopNavPills({ active }: { active: TopNavKey }) {
  const { t } = useI18n();

  return (
    <View className="flex-row gap-2" accessibilityRole="tablist">
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <Pressable
            key={item.key}
            onPress={() => !isActive && router.navigate(item.href)}
            accessibilityRole="tab"
            aria-selected={isActive}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2.5 active:opacity-80 ${
              isActive ? 'bg-surface' : 'bg-white/25'
            }`}>
            <Ionicons
              name={item.icon}
              size={17}
              color={isActive ? colors.primary[500] : colors.surface}
            />
            <Text
              className={`text-[14px] font-semibold ${isActive ? 'text-ink' : 'text-white'}`}
              numberOfLines={1}>
              {t.tabs[item.key]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
