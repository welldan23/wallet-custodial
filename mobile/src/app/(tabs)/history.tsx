import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { HistoryEmpty } from '@/components/history/history-empty';
import { HistoryRow } from '@/components/history/history-row';
import { MonthFilter, monthLabel } from '@/components/history/month-filter';
import { TabScreen } from '@/components/layout/tab-screen';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { useHistory } from '@/hooks/use-history';
import { useSupportedNetworks } from '@/hooks/use-supported-networks';
import { useI18n } from '@/i18n';
import { availableMonths, daysAgo, filterByMonth, groupByDay } from '@/lib/history';
import { MOCK_FX_RATES } from '@/mocks/wallet';
import { cardShadow } from '@/theme/colors';
import type { FiatCurrency, NetworkId } from '@/types/wallet';

/** Mata uang pendamping USD. Nanti diambil dari Pengaturan. */
const DISPLAY_CURRENCY: FiatCurrency = 'IDR';

/** Riwayat: semua kirim, terima, dan swap, dikelompokkan per hari. */
export default function HistoryScreen() {
  const { t } = useI18n();
  const history = useHistory();
  const networks = useSupportedNetworks();
  const { hidden } = useBalanceVisibility();
  const [month, setMonth] = useState<string | null>(null);
  const months = availableMonths(history);
  const groups = groupByDay(filterByMonth(history, month));
  const networkName = (id: NetworkId) =>
    networks.find((item) => item.network.id === id)?.network.name ?? id;

  const dayLabel = (day: string) => {
    const ago = daysAgo(day);
    if (ago === 0) return t.history.today;
    if (ago === 1) return t.history.yesterday;
    const [y, m, d] = day.split('-').map(Number);
    return t.history.date(d, t.history.monthsShort[m - 1], y);
  };

  return (
    <TabScreen active="history" title={t.tabs.history}>
      <Text className="-mt-2 text-[13px] text-ink-muted">{t.history.subtitle}</Text>

      {history.length > 0 && <MonthFilter months={months} selected={month} onSelect={setMonth} />}

      {history.length === 0 ? (
        <HistoryEmpty variant="all" onReceive={() => router.push('/receive')} />
      ) : groups.length === 0 && month ? (
        <HistoryEmpty
          variant="month"
          monthLabel={monthLabel(month, t.history.monthsShort)}
          onShowAll={() => setMonth(null)}
        />
      ) : (
        groups.map((group) => (
          <View key={group.day} className="gap-2">
            <Text
              className="px-1 text-[13px] font-semibold text-ink-soft"
              accessibilityRole="header">
              {dayLabel(group.day)}
            </Text>
            <View className="rounded-[20px] bg-surface px-4" style={cardShadow}>
              {group.items.map((item, index) => (
                <HistoryRow
                  key={item.id}
                  item={item}
                  networkName={networkName}
                  currency={DISPLAY_CURRENCY}
                  fxRates={MOCK_FX_RATES}
                  hidden={hidden}
                  isLast={index === group.items.length - 1}
                />
              ))}
            </View>
          </View>
        ))
      )}
    </TabScreen>
  );
}
