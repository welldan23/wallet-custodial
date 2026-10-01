import { Pressable, Text, TextInput, View } from 'react-native';

import type { SendableAsset } from '@/hooks/use-sendable-assets';
import { useI18n } from '@/i18n';
import { formatAmountForInput, normalizeAmountInput, type AmountCheck } from '@/lib/amount';
import { formatFiat } from '@/lib/format';
import { cardShadow, colors } from '@/theme/colors';
import type { FiatCurrency, FxRates } from '@/types/wallet';

type AmountInputProps = {
  value: string;
  onChange: (value: string) => void;
  asset: SendableAsset;
  check: AmountCheck;
  /** Jumlah maksimal yang boleh dikirim (sudah dikurangi biaya kalau kirim koin gas). */
  maxAmount: number;
  usdPrice: number;
  currency: FiatCurrency;
  fxRates: FxRates;
};

/** Kolom jumlah: angka besar + simbol, nilai Rupiah, tombol Maks, dan pesan error. */
export function AmountInput({
  value,
  onChange,
  asset,
  check,
  maxAmount,
  usdPrice,
  currency,
  fxRates,
}: AmountInputProps) {
  const { t } = useI18n();
  const parsed = Number(normalizeAmountInput(value));
  const fiat = Number.isFinite(parsed) ? formatFiat(parsed * usdPrice, currency, fxRates) : '—';
  const invalid = check.status === 'invalid';

  return (
    <View className="rounded-[20px] bg-surface px-4 py-3.5" style={cardShadow}>
      <Text className="mb-2 text-[13px] font-semibold text-ink-muted">{t.send.amountLabel}</Text>
      <View
        className={`flex-row items-center gap-2 rounded-2xl border bg-subtle px-3 py-1 ${
          invalid ? 'border-danger-500' : 'border-line'
        }`}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="0"
          placeholderTextColor={colors.ink.faint}
          keyboardType="decimal-pad"
          inputMode="decimal"
          accessibilityLabel={t.send.amountLabel}
          className="min-h-[52px] flex-1 text-[26px] font-bold text-ink"
          style={[{ fontVariant: ['tabular-nums'] }, { outlineStyle: 'none' } as object]}
        />
        <Text className="text-base font-bold text-ink-soft">{asset.symbol}</Text>
        <Pressable
          onPress={() => onChange(formatAmountForInput(maxAmount, asset.decimals))}
          accessibilityRole="button"
          accessibilityLabel={t.send.maxLabel}
          className="rounded-full bg-primary-50 px-3 py-1.5 active:opacity-70">
          <Text className="text-xs font-bold text-primary-500">{t.send.max}</Text>
        </Pressable>
      </View>
      <View className="mt-2 flex-row items-start justify-between gap-2">
        <Text className={`flex-1 text-xs ${invalid ? 'text-danger-600' : 'text-ink-muted'}`}>
          {invalid ? t.send.amountError[check.reason] : `≈ ${fiat}`}
        </Text>
      </View>
    </View>
  );
}
