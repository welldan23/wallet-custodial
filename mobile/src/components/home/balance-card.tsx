import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { formatFiat, formatTime, formatUsd, formatUsdNumber, MASKED_VALUE } from '@/lib/format';
import { balanceCardGradient } from '@/theme/colors';
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
};

const tabularNums = { fontVariant: ['tabular-nums' as const] };

/** Kartu hijau gelap berisi total saldo USD + konversi ke mata uang tampilan. */
export function BalanceCard({
  totalUsd,
  currency,
  fxRates,
  pricesUpdatedAt,
  hidden,
  onToggleHidden,
}: BalanceCardProps) {
  const { t } = useI18n();
  const showConversion = currency !== 'USD';
  const convertedTotal = showConversion ? formatFiat(totalUsd, currency, fxRates) : undefined;

  return (
    <LinearGradient
      colors={balanceCardGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 24, overflow: 'hidden' }}>
      {/* Lingkaran dekoratif transparan di pojok kartu */}
      <View
        pointerEvents="none"
        className="absolute h-48 w-48 rounded-full bg-white/10"
        style={{ right: -56, top: -84 }}
      />
      <View
        pointerEvents="none"
        className="absolute h-36 w-36 rounded-full bg-white/5"
        style={{ right: 48, bottom: -96 }}
      />

      <View className="px-5 pb-5 pt-4">
        <View className="flex-row items-center gap-2">
          <Text className="text-[13px] font-medium text-white/80">{t.home.totalBalance}</Text>
          <Pressable
            onPress={onToggleHidden}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? t.home.showBalance : t.home.hideBalance}>
            <Ionicons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={17}
              color="rgba(255,255,255,0.85)"
            />
          </Pressable>
        </View>

        <View
          accessible
          accessibilityLabel={
            hidden
              ? t.home.balanceHiddenLabel
              : t.home.totalBalanceLabel(formatUsd(totalUsd), convertedTotal)
          }>
          <Text
            className="mt-2 font-bold text-white"
            style={[{ fontSize: 34, letterSpacing: -0.5 }, tabularNums]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {hidden ? (
              MASKED_VALUE
            ) : (
              <>
                <Text style={{ fontSize: 26 }}>$ </Text>
                {formatUsdNumber(totalUsd)}
              </>
            )}
          </Text>

          {convertedTotal && (
            <View className="mt-2 self-start rounded-full bg-white/15 px-3 py-1">
              <Text className="text-[15px] font-semibold text-white" style={tabularNums}>
                ≈ {hidden ? MASKED_VALUE : convertedTotal}
              </Text>
            </View>
          )}
        </View>

        {showConversion && (
          <Text className="mt-3 text-[11px] font-medium text-white/60">
            {t.home.fxRate(formatFiat(1, currency, fxRates))}
            {pricesUpdatedAt ? ` · ${t.home.updatedAt(formatTime(pricesUpdatedAt))}` : ''}
          </Text>
        )}
      </View>
    </LinearGradient>
  );
}
