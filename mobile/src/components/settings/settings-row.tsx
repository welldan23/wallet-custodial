import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';
import { cardShadow } from '@/theme/colors';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Kartu putih berisi beberapa baris pengaturan, dengan judul kecil di atasnya. */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text
        className="px-1 text-[12px] font-semibold uppercase text-ink-faint"
        accessibilityRole="header">
        {title}
      </Text>
      <View className="rounded-[20px] bg-surface px-4" style={cardShadow}>
        {children}
      </View>
    </View>
  );
}

type SettingsRowProps = {
  icon: IconName;
  label: string;
  /** Nilai saat ini, mis. "Rupiah (IDR)". */
  value?: string;
  hint?: string;
  onPress?: () => void;
  /** Isi kanan selain nilai, mis. Switch. */
  trailing?: ReactNode;
  tone?: 'default' | 'danger';
  isLast?: boolean;
};

/** Satu baris: ikon, label (+ keterangan), nilai, dan panah. */
export function SettingsRow({
  icon,
  label,
  value,
  hint,
  onPress,
  trailing,
  tone = 'default',
  isLast,
}: SettingsRowProps) {
  const colors = useThemeColors();
  const danger = tone === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[label, value].filter(Boolean).join(', ')}
      className={`flex-row items-center gap-3 py-3.5 active:opacity-70 ${isLast ? '' : 'border-b border-line'}`}>
      <View
        className={`h-9 w-9 items-center justify-center rounded-xl ${danger ? 'bg-danger-50' : 'bg-primary-50'}`}>
        <Ionicons name={icon} size={18} color={danger ? colors.danger[600] : colors.primary[500]} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className={`text-[15px] font-semibold ${danger ? 'text-danger-600' : 'text-ink'}`}>
          {label}
        </Text>
        {hint && <Text className="text-xs leading-[17px] text-ink-muted">{hint}</Text>}
      </View>
      {value && (
        <Text className="max-w-[45%] text-right text-sm text-ink-muted" numberOfLines={1}>
          {value}
        </Text>
      )}
      {trailing}
      {onPress && !trailing && (
        <Ionicons name="chevron-forward" size={16} color={colors.ink.faint} />
      )}
    </Pressable>
  );
}
