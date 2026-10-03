import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { TokenNetworkIcon } from '@/components/crypto/token-network-icon';
import { ConfirmRow } from '@/components/send/confirm-row';
import { useToast } from '@/components/ui/toast';
import { useCopy } from '@/hooks/use-copy';
import { useFormat } from '@/hooks/use-format';
import { useI18n } from '@/i18n';
import { groupAddress, shortenAddress } from '@/lib/address';
import { formatTime, MASKED_VALUE } from '@/lib/format';
import { historyAmounts, localDay, type HistoryItem, type HistoryStatus } from '@/lib/history';
import { explorerTxUrl } from '@/lib/sent-transfers';
import { cardShadow, colors } from '@/theme/colors';
import type { FiatCurrency, FxRates, Network, NetworkId } from '@/types/wallet';

const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });
const tabularNums = { fontVariant: ['tabular-nums' as const] };

const STATUS_STYLES: Record<
  HistoryStatus,
  { icon: ComponentProps<typeof Ionicons>['name']; color: string; tile: string; text: string }
> = {
  success: {
    icon: 'checkmark-circle',
    color: colors.success[500],
    tile: 'bg-success-50',
    text: 'text-success-600',
  },
  pending: {
    icon: 'time',
    color: colors.warning[500],
    tile: 'bg-warning-50',
    text: 'text-warning-600',
  },
  failed: {
    icon: 'close-circle',
    color: colors.danger[500],
    tile: 'bg-danger-50',
    text: 'text-danger-600',
  },
};

type TransactionDetailProps = {
  item: HistoryItem;
  networkOf: (id: NetworkId) => Network | undefined;
  currency: FiatCurrency;
  fxRates: FxRates;
  hidden: boolean;
  /** Mode demo: hash tiruan, jadi tautan explorer diganti penjelasan. */
  isDemo: boolean;
};

/**
 * Detail satu transaksi: status, jumlah, waktu lengkap, jaringan, alamat
 * lawan (bisa disalin), biaya, hash, dan tautan block explorer.
 */
export function TransactionDetail({
  item,
  networkOf,
  currency,
  fxRates,
  hidden,
  isDemo,
}: TransactionDetailProps) {
  const { formatFiat, formatTokenAmount } = useFormat();
  const { t } = useI18n();
  const toast = useToast();
  const copy = useCopy();
  const network = networkOf(item.networkId);
  const toNetwork = item.swap ? networkOf(item.swap.toNetworkId) : undefined;
  const status = STATUS_STYLES[item.status];
  const { main, swapped } = historyAmounts(item);
  const mask = (text: string) => (hidden ? MASKED_VALUE : text);
  const fiat = (usd: number) => mask(formatFiat(usd, currency, fxRates));

  const [y, m, d] = localDay(item.createdAt).split('-').map(Number);
  const when = t.history.dateTime(
    t.history.date(d, t.history.monthsShort[m - 1], y),
    formatTime(item.createdAt),
  );

  const title =
    item.type === 'swap' && item.swap
      ? t.history.titleSwap(item.symbol, item.swap.toSymbol)
      : t.history.title[item.type](item.symbol);

  const openExplorer = () => {
    if (isDemo || !network) {
      toast({ title: t.send.demoExplorerTitle, message: t.send.demoExplorerBody });
      return;
    }
    Linking.openURL(explorerTxUrl(network.explorerUrl, item.txHash)).catch(() => {});
  };

  const counterpartyLabel = item.type === 'receive' ? t.history.rowFrom : t.history.rowTo;

  return (
    <View className="gap-4">
      <View className="items-center rounded-[20px] bg-surface px-5 py-6" style={cardShadow}>
        <TokenNetworkIcon
          symbol={main.symbol}
          networkId={item.swap?.toNetworkId ?? item.networkId}
          size={52}
        />
        <Text className="mt-3 text-[13px] text-ink-muted">{title}</Text>
        <Text
          className={`mt-1 text-[28px] font-bold ${
            item.status === 'failed'
              ? 'text-ink-faint line-through'
              : main.sign === '+'
                ? 'text-success-600'
                : 'text-ink'
          }`}
          style={tabularNums}>
          {main.sign}
          {mask(formatTokenAmount(main.amount, main.isStablecoin))} {main.symbol}
        </Text>
        <Text className="mt-0.5 text-sm font-semibold text-ink-muted" style={tabularNums}>
          {swapped
            ? `${swapped.sign}${mask(formatTokenAmount(swapped.amount, swapped.isStablecoin))} ${swapped.symbol}`
            : `≈ ${fiat(item.amountUsd)}`}
        </Text>
        <View
          className={`mt-3 flex-row items-center gap-1.5 rounded-full px-3 py-1 ${status.tile}`}
          accessibilityLabel={t.history.statusLabel(t.history.statusFull[item.status])}>
          <Ionicons name={status.icon} size={14} color={status.color} />
          <Text className={`text-xs font-bold ${status.text}`}>
            {t.history.statusFull[item.status]}
          </Text>
        </View>
        {item.status !== 'success' && (
          <Text className="mt-2 text-center text-xs leading-[18px] text-ink-muted">
            {item.status === 'pending' ? t.history.pendingNote : t.history.failedNote}
          </Text>
        )}
      </View>

      <View className="rounded-[20px] bg-surface px-4 py-1" style={cardShadow}>
        <ConfirmRow label={t.history.rowTime}>
          <Text className="text-sm font-semibold text-ink">{when}</Text>
        </ConfirmRow>
        <ConfirmRow label={t.send.rowNetwork}>
          <View className="flex-row items-center gap-1.5">
            {network && <NetworkIcon networkId={network.id} size={16} />}
            <Text className="text-sm font-semibold text-ink">
              {network?.name ?? item.networkId}
              {toNetwork && toNetwork.id !== item.networkId ? ` → ${toNetwork.name}` : ''}
            </Text>
          </View>
        </ConfirmRow>
        {item.swap && (
          <ConfirmRow label={t.swap.rowRoute}>
            <Text className="text-sm font-semibold text-ink">
              {toNetwork && toNetwork.id !== item.networkId
                ? t.swap.viaBridge(item.swap.provider)
                : t.swap.via(item.swap.provider)}
            </Text>
          </ConfirmRow>
        )}
        {item.counterparty && (
          <ConfirmRow label={counterpartyLabel} hint={item.counterpartyLabel}>
            <Pressable
              onPress={() =>
                copy(
                  item.counterparty!,
                  t.history.addressCopied,
                  shortenAddress(item.counterparty!),
                )
              }
              accessibilityRole="button"
              accessibilityLabel={t.history.copyAddress}
              className="flex-row items-start gap-1.5 active:opacity-70">
              <Text
                className="shrink text-right text-[13px] leading-5 text-ink"
                style={{ fontFamily: monoFont }}>
                {groupAddress(item.counterparty).join(' ')}
              </Text>
              <Ionicons name="copy-outline" size={15} color={colors.primary[500]} />
            </Pressable>
          </ConfirmRow>
        )}
        <ConfirmRow
          label={t.send.rowFee}
          hint={item.type === 'receive' ? t.history.feePaidBySender : undefined}>
          {item.type === 'receive' ? (
            <Text className="text-sm font-semibold text-ink">—</Text>
          ) : (
            <>
              <Text className="text-sm font-semibold text-ink" style={tabularNums}>
                ≈ {formatTokenAmount(item.fee, false)} {network?.nativeSymbol}
              </Text>
              <Text className="text-xs text-ink-muted">≈ {fiat(item.feeUsd)}</Text>
            </>
          )}
        </ConfirmRow>
        <ConfirmRow label={t.send.rowTxHash} isLast>
          <Pressable
            onPress={() =>
              copy(item.txHash, t.send.txHashCopied, shortenAddress(item.txHash, 10, 8))
            }
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t.send.copyTxHash}
            className="flex-row items-center gap-1.5 active:opacity-70">
            <Text className="text-[13px] font-semibold text-ink" style={{ fontFamily: monoFont }}>
              {shortenAddress(item.txHash, 8, 6)}
            </Text>
            <Ionicons name="copy-outline" size={15} color={colors.primary[500]} />
          </Pressable>
        </ConfirmRow>
      </View>

      <Pressable
        onPress={openExplorer}
        accessibilityRole="link"
        className="flex-row items-center justify-center gap-1.5 py-1 active:opacity-70">
        <Text className="text-sm font-semibold text-primary-500">{t.send.viewExplorer}</Text>
        <Ionicons name="open-outline" size={15} color={colors.primary[500]} />
      </Pressable>
    </View>
  );
}
