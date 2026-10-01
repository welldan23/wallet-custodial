import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { cardShadow, colors } from '@/theme/colors';

type HistoryEmptyProps =
  /** Wallet belum pernah bertransaksi sama sekali. */
  | { variant: 'all'; onReceive: () => void }
  /** Ada riwayat, tapi tidak ada di bulan yang dipilih. */
  | { variant: 'month'; monthLabel: string; onShowAll: () => void };

const KINDS: { icon: ComponentProps<typeof Ionicons>['name']; tile: string; color: string }[] = [
  { icon: 'arrow-down', tile: 'bg-success-50', color: colors.success[500] },
  { icon: 'arrow-up', tile: 'bg-primary-50', color: colors.primary[500] },
  { icon: 'swap-horizontal', tile: 'bg-teal-300/25', color: colors.teal[500] },
];

/** Tampilan saat Riwayat kosong: wallet baru, atau bulan terpilih tanpa transaksi. */
export function HistoryEmpty(props: HistoryEmptyProps) {
  const { t } = useI18n();
  const isMonth = props.variant === 'month';

  return (
    <View className="items-center rounded-[20px] bg-surface px-6 py-9" style={cardShadow}>
      <View
        className="flex-row items-center"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {KINDS.map((kind, index) => (
          <View
            key={kind.icon}
            className={`h-12 w-12 items-center justify-center rounded-full border-4 border-surface ${kind.tile} ${
              index > 0 ? '-ml-3' : ''
            }`}>
            <Ionicons name={kind.icon} size={20} color={kind.color} />
          </View>
        ))}
      </View>

      <Text className="mt-4 text-center text-lg font-bold text-ink" accessibilityRole="header">
        {isMonth ? t.history.emptyMonthTitle(props.monthLabel) : t.history.emptyTitle}
      </Text>
      <Text className="mt-1.5 text-center text-sm leading-5 text-ink-muted">
        {isMonth ? t.history.emptyMonthBody : t.history.emptyBody}
      </Text>

      {!isMonth && (
        <View className="mt-4 w-full gap-2 rounded-2xl bg-subtle px-4 py-3">
          {[t.history.emptyStep1, t.history.emptyStep2].map((step, index) => (
            <View key={step} className="flex-row items-start gap-2.5">
              <View className="mt-px h-5 w-5 items-center justify-center rounded-full bg-primary-500">
                <Text className="text-[11px] font-bold text-white">{index + 1}</Text>
              </View>
              <Text className="flex-1 text-[13px] leading-5 text-ink-soft">{step}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        onPress={props.variant === 'month' ? props.onShowAll : props.onReceive}
        accessibilityRole="button"
        className={`mt-5 flex-row items-center gap-2 rounded-full px-6 py-3 active:opacity-80 ${
          isMonth ? 'bg-primary-50' : 'bg-primary-500'
        }`}>
        <Ionicons
          name={isMonth ? 'list' : 'arrow-down'}
          size={18}
          color={isMonth ? colors.primary[500] : colors.surface}
        />
        <Text className={`font-semibold ${isMonth ? 'text-primary-500' : 'text-white'}`}>
          {isMonth ? t.history.showAllMonths : t.home.emptyCta}
        </Text>
      </Pressable>
    </View>
  );
}
