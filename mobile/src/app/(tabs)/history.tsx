import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { HistoryRow } from '@/components/history/history-row';
import { TabScreen } from '@/components/layout/tab-screen';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { useHistory } from '@/hooks/use-history';
import { useSupportedNetworks } from '@/hooks/use-supported-networks';
import { useI18n } from '@/i18n';
import { daysAgo, groupByDay } from '@/lib/history';
import { MOCK_FX_RATES } from '@/mocks/wallet';
import { cardShadow, colors } from '@/theme/colors';
import type { FiatCurrency, NetworkId } from '@/types/wallet';

/** Mata uang pendamping USD. Nanti diambil dari Pengaturan. */
const DISPLAY_CURRENCY: FiatCurrency = 'IDR';

/** Riwayat: semua kirim, terima, dan swap, dikelompokkan per hari. */
export default function HistoryScreen() {
  const { t } = useI18n();
  const history = useHistory();
  const networks = useSupportedNetworks();
  const { hidden } = useBalanceVisibility();
  const groups = groupByDay(history);
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

      {groups.length === 0 ? (
        <View
          className="items-center gap-3 rounded-[20px] bg-surface px-6 py-10"
          style={cardShadow}>
          <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-50">
            <Ionicons name="receipt-outline" size={26} color={colors.primary[500]} />
          </View>
          <Text className="text-base font-bold text-ink">{t.history.emptyTitle}</Text>
          <Text className="text-center text-sm leading-5 text-ink-muted">
            {t.history.emptyBody}
          </Text>
          <Pressable
            onPress={() => router.push('/receive')}
            accessibilityRole="button"
            className="mt-1 rounded-full bg-primary-500 px-6 py-3 active:opacity-80">
            <Text className="font-semibold text-white">{t.home.emptyCta}</Text>
          </Pressable>
        </View>
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
