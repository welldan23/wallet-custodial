import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { useI18n } from '@/i18n';
import { shortenAddress } from '@/lib/address';
import { formatTime, formatTokenAmount, MASKED_VALUE } from '@/lib/format';
import type { HistoryItem, HistoryStatus, HistoryType } from '@/lib/history';
import { colors } from '@/theme/colors';

const TYPE_STYLES: Record<
  HistoryType,
  { icon: ComponentProps<typeof Ionicons>['name']; tile: string; color: string }
> = {
  receive: { icon: 'arrow-down', tile: 'bg-success-50', color: colors.success[500] },
  send: { icon: 'arrow-up', tile: 'bg-primary-50', color: colors.primary[500] },
  swap: { icon: 'swap-horizontal', tile: 'bg-teal-300/25', color: colors.teal[500] },
};

const STATUS_STYLES: Record<Exclude<HistoryStatus, 'success'>, { chip: string; text: string }> = {
  pending: { chip: 'bg-warning-50', text: 'text-warning-600' },
  failed: { chip: 'bg-danger-50', text: 'text-danger-600' },
};

const tabularNums = { fontVariant: ['tabular-nums' as const] };

/** Satu transaksi di daftar Riwayat: ikon jenis, judul, lawan transaksi, jumlah, status. */
export function HistoryRow({
  item,
  networkName,
  hidden,
  isLast,
}: {
  item: HistoryItem;
  networkName: (id: HistoryItem['networkId']) => string;
  hidden: boolean;
  isLast: boolean;
}) {
  const { t } = useI18n();
  const style = TYPE_STYLES[item.type];
  const failed = item.status === 'failed';
  const amount = (value: number, symbol: string, stable: boolean) =>
    `${hidden ? MASKED_VALUE : formatTokenAmount(value, stable)} ${symbol}`;

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

  let main: string;
  let mainClass = 'text-ink';
  let sub: string | null = null;
  if (item.type === 'swap' && item.swap) {
    main = `+${amount(item.swap.toAmount, item.swap.toSymbol, true)}`;
    mainClass = 'text-success-600';
    sub = `−${amount(item.amount, item.symbol, true)}`;
  } else if (item.type === 'receive') {
    main = `+${amount(item.amount, item.symbol, item.isStablecoin)}`;
    mainClass = 'text-success-600';
  } else {
    main = `−${amount(item.amount, item.symbol, item.isStablecoin)}`;
  }
  if (failed) mainClass = 'text-ink-faint line-through';

  const statusLabel = item.status === 'success' ? null : t.history.status[item.status];
  const time = formatTime(item.createdAt);

  return (
    <View
      className={`flex-row items-center gap-3 py-3 ${isLast ? '' : 'border-b border-line'}`}
      accessible
      accessibilityLabel={[title, subtitle, main, sub, statusLabel, time]
        .filter(Boolean)
        .join(', ')}>
      <View>
        <View className={`h-11 w-11 items-center justify-center rounded-full ${style.tile}`}>
          <Ionicons name={style.icon} size={20} color={style.color} />
        </View>
        <View className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-surface">
          <NetworkIcon networkId={item.networkId} size={16} />
        </View>
      </View>

      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
          {title}
        </Text>
        <View className="flex-row">
          <Text className="shrink text-xs text-ink-muted" numberOfLines={1}>
            {subtitle}
          </Text>
          <Text className="shrink-0 text-xs text-ink-muted" numberOfLines={1}>
            {`\u00A0· ${time}`}
          </Text>
        </View>
      </View>

      <View className="max-w-[48%] items-end gap-0.5">
        <Text className={`text-sm font-bold ${mainClass}`} style={tabularNums} numberOfLines={1}>
          {main}
        </Text>
        {sub && (
          <Text className="text-[11px] text-ink-muted" style={tabularNums} numberOfLines={1}>
            {sub}
          </Text>
        )}
        {statusLabel && item.status !== 'success' && (
          <View className={`rounded-full px-2 py-0.5 ${STATUS_STYLES[item.status].chip}`}>
            <Text className={`text-[10px] font-bold ${STATUS_STYLES[item.status].text}`}>
              {statusLabel}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
