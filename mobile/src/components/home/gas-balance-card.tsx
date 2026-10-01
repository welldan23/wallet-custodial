import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { useI18n } from '@/i18n';
import { formatFiat, formatTokenAmount, formatUsd, MASKED_VALUE } from '@/lib/format';
import type { ChainGas, GasStatus, GasSummary } from '@/lib/gas';
import { cardShadow, colors } from '@/theme/colors';
import type { FiatCurrency, FxRates, NetworkId } from '@/types/wallet';

type GasBalanceCardProps = {
  summary: GasSummary;
  currency: FiatCurrency;
  fxRates: FxRates;
  hidden: boolean;
  /** Tombol "Isi" di jaringan yang gasnya menipis/kosong. */
  onTopUp?: (networkId: NetworkId) => void;
};

const STATUS_STYLES: Record<GasStatus, { chip: string; text: string }> = {
  ok: { chip: 'bg-success-50', text: 'text-success-600' },
  low: { chip: 'bg-warning-50', text: 'text-warning-600' },
  empty: { chip: 'bg-danger-50', text: 'text-danger-600' },
};

const tabularNums = { fontVariant: ['tabular-nums' as const] };

/**
 * Satu kartu untuk semua gas: total nilai koin gas di semua jaringan,
 * lalu status per jaringan (cukup / menipis / kosong).
 */
export function GasBalanceCard({
  summary,
  currency,
  fxRates,
  hidden,
  onTopUp,
}: GasBalanceCardProps) {
  const { t } = useI18n();
  const attention = summary.needsTopUp;

  return (
    <View className="rounded-[20px] bg-surface px-4 pb-3 pt-4" style={cardShadow}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-lg font-bold text-ink">{t.gas.title}</Text>
          <Text className="text-xs text-ink-muted">{t.gas.subtitle}</Text>
        </View>
        <View className="items-end">
          <Text className="text-base font-bold text-ink" style={tabularNums}>
            {hidden ? MASKED_VALUE : formatUsd(summary.totalUsd)}
          </Text>
          {currency !== 'USD' && (
            <Text className="text-xs text-ink-muted" style={tabularNums}>
              ≈ {hidden ? MASKED_VALUE : formatFiat(summary.totalUsd, currency, fxRates)}
            </Text>
          )}
        </View>
      </View>

      {attention.length > 0 && (
        <View className="mt-3 flex-row items-start gap-2 rounded-xl bg-warning-50 px-3 py-2.5">
          <Ionicons name="warning" size={16} color={colors.warning[600]} />
          <Text className="flex-1 text-xs leading-[18px] text-warning-600">
            {attention.length <= 2
              ? t.gas.warningNamed(attention.map((chain) => chain.network.name).join(' & '))
              : t.gas.warningCount(attention.length)}
          </Text>
        </View>
      )}

      <View className="mt-1">
        {summary.chains.map((chain, index) => (
          <GasChainRow
            key={chain.network.id}
            chain={chain}
            hidden={hidden}
            isLast={index === summary.chains.length - 1}
            onTopUp={onTopUp}
          />
        ))}
      </View>

      <Text className="mt-1 text-[11px] text-ink-faint">{t.gas.estimateNote}</Text>
    </View>
  );
}

type GasChainRowProps = {
  chain: ChainGas;
  hidden: boolean;
  isLast: boolean;
  onTopUp?: (networkId: NetworkId) => void;
};

function GasChainRow({ chain, hidden, isLast, onTopUp }: GasChainRowProps) {
  const { t } = useI18n();
  const style = STATUS_STYLES[chain.status];
  const statusLabel = t.gas.status[chain.status];
  const amountLabel = `${formatTokenAmount(chain.amount, false)} ${chain.symbol}`;

  let estimate: string | null = null;
  if (chain.status !== 'empty') {
    if (chain.estimatedTxCount === 0) estimate = t.gas.lessThanOneTx;
    else if (chain.estimatedTxCount >= 100) estimate = t.gas.manyTx;
    else estimate = t.gas.txEstimate(chain.estimatedTxCount);
  }

  return (
    <View className={`flex-row items-center gap-3 py-3 ${isLast ? '' : 'border-b border-line'}`}>
      <View
        className="flex-1 flex-row items-center gap-3"
        accessible
        accessibilityLabel={[
          chain.network.name,
          hidden ? null : amountLabel,
          statusLabel,
          hidden ? null : estimate,
        ]
          .filter(Boolean)
          .join(', ')}>
        <NetworkIcon networkId={chain.network.id} size={30} />

        <View className="flex-1">
          <Text className="text-sm font-semibold text-ink">{chain.network.name}</Text>
          <Text className="text-xs text-ink-muted" style={tabularNums}>
            {hidden ? MASKED_VALUE : amountLabel}
          </Text>
        </View>

        <View className="items-end gap-1">
          <View className={`rounded-full px-2 py-0.5 ${style.chip}`}>
            <Text className={`text-[11px] font-semibold ${style.text}`}>{statusLabel}</Text>
          </View>
          {estimate && (
            <Text className="text-[11px] text-ink-muted">{hidden ? MASKED_VALUE : estimate}</Text>
          )}
        </View>
      </View>

      {onTopUp && chain.status !== 'ok' && (
        <Pressable
          onPress={() => onTopUp(chain.network.id)}
          accessibilityRole="button"
          accessibilityLabel={t.gas.topUpLabel(chain.network.name)}
          className="rounded-full bg-primary-50 px-3 py-1.5 active:opacity-70">
          <Text className="text-xs font-semibold text-primary-500">{t.gas.topUp}</Text>
        </Pressable>
      )}
    </View>
  );
}
