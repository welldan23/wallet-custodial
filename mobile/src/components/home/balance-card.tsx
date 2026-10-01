import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { formatFiat, formatTime, formatUsd, formatUsdNumber, MASKED_VALUE } from '@/lib/format';
import { cardShadow, colors } from '@/theme/colors';
import type { FiatCurrency, FxRates } from '@/types/wallet';

type BalanceCardProps = {
  totalUsd: number;
  /** Mata uang pendamping USD, mis. IDR. Kalau `USD`, baris konversi tidak tampil. */
  currency: FiatCurrency;
  fxRates: FxRates;
  /** Waktu harga/kurs terakhir diperbarui (ISO). */
  pricesUpdatedAt?: string;
  hidden: boolean;
  onToggleHidden: () => void;
  /** Tombol panah di kanan kartu, mis. buka Portfolio. */
  onPressDetail?: () => void;
};

const tabularNums = { fontVariant: ['tabular-nums' as const] };

/** Kartu abu-abu muda berisi total saldo USD + konversi ke mata uang tampilan. */
export function BalanceCard({
  totalUsd,
  currency,
  fxRates,
  pricesUpdatedAt,
  hidden,
  onToggleHidden,
  onPressDetail,
}: BalanceCardProps) {
  const { t } = useI18n();
  const showConversion = currency !== 'USD';
  const convertedTotal = showConversion ? formatFiat(totalUsd, currency, fxRates) : undefined;

  return (
    <View className="rounded-[20px] bg-subtle px-4 pb-4 pt-3.5">
      <View className="flex-row items-center gap-1.5">
        <Text className="text-[13px] font-medium text-ink-muted">{t.home.totalBalance}</Text>
        <Pressable
          onPress={onToggleHidden}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={hidden ? t.home.showBalance : t.home.hideBalance}>
          <Ionicons
            name={hidden ? 'eye-off-outline' : 'eye-outline'}
            size={17}
            color={colors.ink.soft}
          />
        </Pressable>
      </View>

      <View className="mt-1 flex-row items-center gap-3">
        <View
          className="flex-1"
          accessible
          accessibilityLabel={
            hidden
              ? t.home.balanceHiddenLabel
              : t.home.totalBalanceLabel(formatUsd(totalUsd), convertedTotal)
          }>
          <Text
            className="font-bold text-ink"
            style={[{ fontSize: 32, letterSpacing: -0.5 }, tabularNums]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {hidden ? MASKED_VALUE : `$ ${formatUsdNumber(totalUsd)}`}
          </Text>
          {convertedTotal && (
            <Text className="mt-0.5 text-base font-semibold text-ink-muted" style={tabularNums}>
              ≈ {hidden ? MASKED_VALUE : convertedTotal}
            </Text>
          )}
        </View>

        {onPressDetail && (
          <Pressable
            onPress={onPressDetail}
            accessibilityRole="button"
            accessibilityLabel={t.home.balanceDetail}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70"
            style={cardShadow}>
            <Ionicons name="chevron-forward" size={18} color={colors.ink.DEFAULT} />
          </Pressable>
        )}
      </View>

      {showConversion && (
        <Text className="mt-2 text-[11px] font-medium text-ink-faint">
          {t.home.fxRate(formatFiat(1, currency, fxRates))}
          {pricesUpdatedAt ? ` · ${t.home.updatedAt(formatTime(pricesUpdatedAt))}` : ''}
        </Text>
      )}
    </View>
  );
}
