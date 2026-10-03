import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { ConfirmRow } from '@/components/send/confirm-row';
import type { SwapAsset } from '@/hooks/use-swap-assets';
import { useFormat } from '@/hooks/use-format';
import { useI18n } from '@/i18n';
import { minReceived } from '@/lib/slippage';
import type { SwapQuote } from '@/mocks/swap';
import { useThemeColors } from '@/hooks/use-theme';
import { cardShadow } from '@/theme/colors';

type SwapDetailsCardProps = {
  from: SwapAsset;
  to: SwapAsset;
  quote: SwapQuote | null;
  loading: boolean;
  /** Biaya jaringan dalam koin gas jaringan asal. */
  networkFeeNative: number;
  nativeSymbol: string;
  fiat: (usd: number) => string;
  /** Slippage dalam persen. */
  slippage: number;
  /** Kalau diisi, slippage bisa diubah dari kartu ini. */
  onEditSlippage?: () => void;
};

const tabularNums = { fontVariant: ['tabular-nums' as const] };

/** Rincian sebelum swap: kurs, rute, biaya jaringan/bridge, dan jumlah akhir. */
export function SwapDetailsCard({
  from,
  to,
  quote,
  loading,
  networkFeeNative,
  nativeSymbol,
  fiat,
  slippage,
  onEditSlippage,
}: SwapDetailsCardProps) {
  const colors = useThemeColors();
  const { formatNumber, formatTokenAmount } = useFormat();
  const { t } = useI18n();

  if (loading || !quote) {
    return (
      <View
        className="flex-row items-center justify-center gap-2 rounded-[20px] bg-surface px-4 py-6"
        style={cardShadow}
        accessibilityLiveRegion="polite">
        {loading ? (
          <>
            <ActivityIndicator size="small" color={colors.primary[500]} />
            <Text className="text-[13px] text-ink-muted">{t.swap.findingRoute}</Text>
          </>
        ) : (
          <Text className="text-[13px] text-ink-muted">{t.swap.noRoute}</Text>
        )}
      </View>
    );
  }

  const eta =
    quote.etaSeconds >= 60
      ? t.swap.etaMinutes(Math.round(quote.etaSeconds / 60))
      : t.swap.etaSeconds(quote.etaSeconds);

  return (
    <View className="rounded-[20px] bg-surface px-4 py-1" style={cardShadow}>
      <ConfirmRow
        label={t.swap.rowRate}
        hint={t.swap.providerFeeHint(
          `${formatNumber(quote.providerFeeRate * 100, { maximumFractionDigits: 2 })}%`,
        )}>
        <Text className="text-sm font-semibold text-ink" style={tabularNums}>
          {t.swap.rate(
            from.symbol,
            formatNumber(quote.rate, { maximumFractionDigits: 4 }),
            to.symbol,
          )}
        </Text>
      </ConfirmRow>
      <ConfirmRow label={t.swap.rowRoute} hint={eta}>
        <Text className="text-sm font-semibold text-ink">
          {quote.crossChain ? t.swap.viaBridge(quote.provider) : t.swap.via(quote.provider)}
        </Text>
      </ConfirmRow>
      <ConfirmRow label={t.send.rowFee} hint={t.send.rowFeeHint(nativeSymbol)}>
        <Text className="text-sm font-semibold text-ink" style={tabularNums}>
          ≈ {formatTokenAmount(networkFeeNative, false)} {nativeSymbol}
        </Text>
        <Text className="text-xs text-ink-muted">≈ {fiat(quote.networkFeeUsd)}</Text>
      </ConfirmRow>
      {quote.crossChain && (
        <ConfirmRow label={t.swap.rowBridgeFee} hint={t.swap.bridgeFeeHint(to.symbol)}>
          <Text className="text-sm font-semibold text-ink">≈ {fiat(quote.bridgeFeeUsd)}</Text>
        </ConfirmRow>
      )}
      <ConfirmRow label={t.swap.rowSlippage}>
        {onEditSlippage ? (
          <Pressable
            onPress={onEditSlippage}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t.swap.editSlippage(slippage)}
            className="flex-row items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 active:opacity-70">
            <Text className="text-[13px] font-bold text-primary-500">{slippage}%</Text>
            <Ionicons name="create-outline" size={14} color={colors.primary[500]} />
          </Pressable>
        ) : (
          <Text className="text-sm font-semibold text-ink">{slippage}%</Text>
        )}
      </ConfirmRow>
      <ConfirmRow label={t.swap.rowMinReceived} hint={t.swap.minReceivedHint}>
        <Text className="text-sm font-semibold text-ink" style={tabularNums}>
          {formatTokenAmount(minReceived(quote.toAmount, slippage), true)} {to.symbol}
        </Text>
      </ConfirmRow>
      <ConfirmRow label={t.swap.rowFinal} isLast>
        <View className="flex-row items-center gap-1">
          <Ionicons name="arrow-down-circle" size={16} color={colors.success[500]} />
          <Text className="text-base font-bold text-ink" style={tabularNums}>
            {formatTokenAmount(quote.toAmount, true)} {to.symbol}
          </Text>
        </View>
        <Text className="text-xs text-ink-muted">
          ≈ {fiat(quote.toAmount * to.usdPrice)} · {to.network.name}
        </Text>
      </ConfirmRow>
    </View>
  );
}
