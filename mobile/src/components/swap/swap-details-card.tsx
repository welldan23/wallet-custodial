import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Text, View } from 'react-native';

import { ConfirmRow } from '@/components/send/confirm-row';
import type { SwapAsset } from '@/hooks/use-swap-assets';
import { useI18n } from '@/i18n';
import { formatNumber, formatTokenAmount } from '@/lib/format';
import type { SwapQuote } from '@/mocks/swap';
import { cardShadow, colors } from '@/theme/colors';

type SwapDetailsCardProps = {
  from: SwapAsset;
  to: SwapAsset;
  quote: SwapQuote | null;
  loading: boolean;
  /** Biaya jaringan dalam koin gas jaringan asal. */
  networkFeeNative: number;
  nativeSymbol: string;
  fiat: (usd: number) => string;
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
}: SwapDetailsCardProps) {
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
          {t.swap.rate(from.symbol, formatNumber(quote.rate, { maximumFractionDigits: 4 }), to.symbol)}
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
