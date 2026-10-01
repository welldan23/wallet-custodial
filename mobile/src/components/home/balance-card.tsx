import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { formatFiat, formatUsdNumber, MASKED_VALUE } from '@/lib/format';
import { balanceCardGradient } from '@/theme/colors';
import type { FiatCurrency, FxRates } from '@/types/wallet';

type BalanceCardProps = {
  totalUsd: number;
  currency: FiatCurrency;
  fxRates: FxRates;
  hidden: boolean;
  onToggleHidden: () => void;
};

/** Kartu hijau gelap berisi total saldo USD + konversi ke mata uang tampilan. */
export function BalanceCard({
  totalUsd,
  currency,
  fxRates,
  hidden,
  onToggleHidden,
}: BalanceCardProps) {
  const { t } = useI18n();

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

        <Text
          className="mt-2 font-bold text-white"
          style={{ fontSize: 34, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}
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

        {currency !== 'USD' && (
          <Text className="mt-1 text-sm font-medium text-white/75">
            ≈ {hidden ? MASKED_VALUE : formatFiat(totalUsd, currency, fxRates)}
          </Text>
        )}
      </View>
    </LinearGradient>
  );
}
