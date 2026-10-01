import { Pressable, ScrollView, Text } from 'react-native';

import { useI18n } from '@/i18n';

type MonthFilterProps = {
  months: string[];
  /** `null` = Semua. */
  selected: string | null;
  onSelect: (month: string | null) => void;
};

/** Deretan chip: Semua + tiap bulan (`YYYY-MM`), bisa digeser ke samping. */
export function MonthFilter({ months, selected, onSelect }: MonthFilterProps) {
  const { t } = useI18n();
  const options: (string | null)[] = [null, ...months];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 2, paddingVertical: 2 }}
      accessibilityRole="tablist"
      accessibilityLabel={t.history.filterLabel}>
      {options.map((month) => {
        const active = month === selected;
        const label = month ? monthLabel(month, t.history.monthsShort) : t.history.all;
        return (
          <Pressable
            key={month ?? 'all'}
            onPress={() => onSelect(month)}
            accessibilityRole="tab"
            aria-selected={active}
            accessibilityLabel={month ? t.history.filterMonth(label) : t.history.all}
            className={`rounded-full border px-4 py-2 active:opacity-70 ${
              active ? 'border-primary-500 bg-primary-500' : 'border-line bg-surface'
            }`}>
            <Text
              className={`text-[13px] font-semibold ${active ? 'text-white' : 'text-ink-soft'}`}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** `2026-09` → `Sep 2026`. */
export function monthLabel(month: string, monthsShort: readonly string[]): string {
  const [year, index] = month.split('-').map(Number);
  return `${monthsShort[index - 1]} ${year}`;
}
