import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { useI18n } from '@/i18n';
import { shortenAddress } from '@/lib/address';
import { formatFiat, formatTime, formatTokenAmount, MASKED_VALUE } from '@/lib/format';
import {
  historyAmounts,
  type HistoryAmountLine,
  type HistoryItem,
  type HistoryStatus,
  type HistoryType,
} from '@/lib/history';
import { colors } from '@/theme/colors';
import type { FiatCurrency, FxRates, NetworkId } from '@/types/wallet';

const TYPE_STYLES: Record<
  HistoryType,
  { icon: ComponentProps<typeof Ionicons>['name']; tile: string; color: string }
> = {
  receive: { icon: 'arrow-down', tile: 'bg-success-50', color: colors.success[500] },
  send: { icon: 'arrow-up', tile: 'bg-primary-50', color: colors.primary[500] },
  swap: { icon: 'swap-horizontal', tile: 'bg-teal-300/25', color: colors.teal[500] },
};

const STATUS_STYLES: Record<
  Exclude<HistoryStatus, 'success'>,
  { chip: string; text: string; icon: ComponentProps<typeof Ionicons>['name']; color: string }
> = {
  pending: {
    chip: 'bg-warning-50',
    text: 'text-warning-600',
    icon: 'time',
    color: colors.warning[600],
  },
  failed: {
    chip: 'bg-danger-50',
    text: 'text-danger-600',
    icon: 'close-circle',
    color: colors.danger[600],
  },
};

const tabularNums = { fontVariant: ['tabular-nums' as const] };

type HistoryRowProps = {
  item: HistoryItem;
  networkName: (id: NetworkId) => string;
  currency: FiatCurrency;
  fxRates: FxRates;
  hidden: boolean;
  isLast: boolean;
  /** Kalau diisi, baris bisa diketuk (mis. buka detail). */
  onPress?: () => void;
};

/**
 * Satu transaksi di daftar Riwayat: ikon jenis + jaringan, judul, lawan
 * transaksi + jam, jumlah (+/−), nilai Rupiah atau koin yang ditukar, status.
 */
export function HistoryRow({
  item,
  networkName,
  currency,
  fxRates,
  hidden,
  isLast,
  onPress,
}: HistoryRowProps) {
  const { t } = useI18n();
  const style = TYPE_STYLES[item.type];
  const failed = item.status === 'failed';
  const { main, swapped } = historyAmounts(item);
  const format = (line: HistoryAmountLine) =>
    `${line.sign}${hidden ? MASKED_VALUE : formatTokenAmount(line.amount, line.isStablecoin)} ${line.symbol}`;

  const title =
    item.type === 'swap' && item.swap
      ? t.history.titleSwap(item.symbol, item.swap.toSymbol)
      : t.history.title[item.type](item.symbol);

  const who = item.counterpartyLabel ?? (item.counterparty && shortenAddress(item.counterparty));
  let subtitle = networkName(item.networkId);
  if (item.swap && item.swap.toNetworkId !== item.networkId) {
    subtitle = `${subtitle} → ${networkName(item.swap.toNetworkId)}`;
  }
  if (item.type === 'send' && who) subtitle = t.history.to(who);
  if (item.type === 'receive' && who) subtitle = t.history.from(who);

  const mainText = format(main);
  const secondary = swapped
    ? format(swapped)
    : `≈ ${hidden ? MASKED_VALUE : formatFiat(item.amountUsd, currency, fxRates)}`;
  let mainClass = main.sign === '+' ? 'text-success-600' : 'text-ink';
  if (failed) mainClass = 'text-ink-faint line-through';

  const status = item.status === 'success' ? null : STATUS_STYLES[item.status];
  const statusLabel = item.status === 'success' ? null : t.history.status[item.status];
  const time = formatTime(item.createdAt);
  const label = [title, subtitle, mainText, secondary, statusLabel, time]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      className={`flex-row items-center gap-3 py-3 active:opacity-70 ${
        isLast ? '' : 'border-b border-line'
      }`}>
      <View>
        <View className={`h-11 w-11 items-center justify-center rounded-full ${style.tile}`}>
          <Ionicons name={style.icon} size={20} color={failed ? colors.ink.faint : style.color} />
        </View>
        <View className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-surface">
          <NetworkIcon networkId={item.networkId} size={16} />
        </View>
      </View>

      <View className="flex-1 gap-0.5">
        <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
          {title}
        </Text>
        <View className="flex-row">
          <Text className="shrink text-xs text-ink-muted" numberOfLines={1}>
            {subtitle}
          </Text>
          <Text className="shrink-0 text-xs text-ink-muted" numberOfLines={1}>
            {` · ${time}`}
          </Text>
        </View>
        {status && statusLabel && (
          <View
            className={`mt-0.5 flex-row items-center gap-1 self-start rounded-full px-2 py-0.5 ${status.chip}`}>
            <Ionicons name={status.icon} size={11} color={status.color} />
            <Text className={`text-[10px] font-bold ${status.text}`}>{statusLabel}</Text>
          </View>
        )}
      </View>

      <View className="max-w-[46%] items-end gap-0.5">
        <Text
          className={`text-sm font-bold ${mainClass}`}
          style={tabularNums}
          numberOfLines={1}
          adjustsFontSizeToFit>
          {mainText}
        </Text>
        <Text className="text-[11px] text-ink-muted" style={tabularNums} numberOfLines={1}>
          {secondary}
        </Text>
      </View>

      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.ink.faint} />}
    </Pressable>
  );
}
