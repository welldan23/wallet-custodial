import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { MASKED_VALUE } from '@/lib/format';
import type { HistorySummary } from '@/lib/history';
import { cardShadow, colors } from '@/theme/colors';

const tabularNums = { fontVariant: ['tabular-nums' as const] };

/** Ringkasan periode terpilih: total masuk, total keluar, dan jumlah transaksi. */
export function MonthSummary({
  summary,
  periodLabel,
  formatValue,
  hidden,
}: {
  summary: HistorySummary;
  periodLabel: string;
  formatValue: (usd: number) => string;
  hidden: boolean;
}) {
  const { t } = useI18n();
  const value = (usd: number) => (hidden ? MASKED_VALUE : formatValue(usd));
  const extras = [
    summary.swaps > 0 ? t.history.summarySwaps(summary.swaps) : null,
    summary.pending > 0 ? t.history.summaryPending(summary.pending) : null,
    summary.failed > 0 ? t.history.summaryFailed(summary.failed) : null,
  ].filter(Boolean);

  return (
    <View
      className="rounded-[20px] bg-surface px-4 py-3.5"
      style={cardShadow}
      accessible
      accessibilityLabel={t.history.summaryLabel(
        periodLabel,
        value(summary.inUsd),
        value(summary.outUsd),
        summary.count,
      )}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[13px] font-semibold text-ink-soft">{periodLabel}</Text>
        <Text className="text-xs text-ink-muted">{t.history.summaryCount(summary.count)}</Text>
      </View>
      <View className="mt-3 flex-row gap-3">
        <View className="flex-1 rounded-2xl bg-success-50 px-3 py-2.5">
          <View className="flex-row items-center gap-1">
            <Ionicons name="arrow-down" size={13} color={colors.success[600]} />
            <Text className="text-xs font-semibold text-success-600">{t.history.summaryIn}</Text>
          </View>
          <Text
            className="mt-1 text-[15px] font-bold text-ink"
            style={tabularNums}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {value(summary.inUsd)}
          </Text>
        </View>
        <View className="flex-1 rounded-2xl bg-subtle px-3 py-2.5">
          <View className="flex-row items-center gap-1">
            <Ionicons name="arrow-up" size={13} color={colors.ink.soft} />
            <Text className="text-xs font-semibold text-ink-soft">{t.history.summaryOut}</Text>
          </View>
          <Text
            className="mt-1 text-[15px] font-bold text-ink"
            style={tabularNums}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {value(summary.outUsd)}
          </Text>
        </View>
      </View>
      {extras.length > 0 && (
        <Text className="mt-2.5 text-[11px] text-ink-muted">{extras.join(' · ')}</Text>
      )}
    </View>
  );
}
