import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { TokenNetworkIcon } from '@/components/crypto/token-network-icon';
import { StackScreen } from '@/components/layout/stack-screen';
import { ConfirmRow } from '@/components/send/confirm-row';
import { DemoBanner } from '@/components/ui/demo-banner';
import { useToast } from '@/components/ui/toast';
import { useSupportedNetworks } from '@/hooks/use-supported-networks';
import { useSwaps } from '@/hooks/use-swaps';
import { useSimulatedTransactions } from '@/hooks/use-simulated-transactions';
import { useDisplayCurrency } from '@/hooks/use-settings';
import { useFormat } from '@/hooks/use-format';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { shortenAddress } from '@/lib/address';
import { formatTime } from '@/lib/format';
import { explorerTxUrl } from '@/lib/sent-transfers';
import { MOCK_FX_RATES } from '@/mocks/wallet';
import { cardShadow } from '@/theme/colors';
import type { Network, NetworkId } from '@/types/wallet';

const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Balik ke Home: tutup semua layar Swap supaya tidak bisa "kembali" ke konfirmasi. */
const backToHome = () => router.dismissTo('/');
const swapAgain = () => {
  backToHome();
  router.push('/swap');
};

/** Status swap setelah disetujui: diproses → berhasil. */
export default function SwapStatusScreen() {
  const colors = useThemeColors();
  const { formatFiat, formatTokenAmount } = useFormat();
  const displayCurrency = useDisplayCurrency();
  const { t } = useI18n();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { swaps } = useSwaps();
  const isDemo = useSimulatedTransactions();
  const networks = useSupportedNetworks();
  const networkOf = (networkId: NetworkId): Network | undefined =>
    networks.find((item) => item.network.id === networkId)?.network;

  const swap = swaps.find((item) => item.id === id);
  const fromNetwork = swap && networkOf(swap.fromNetworkId);
  const toNetwork = swap && networkOf(swap.toNetworkId);

  if (!swap || !fromNetwork || !toNetwork) {
    return (
      <StackScreen title={t.swap.statusTitle} onBack={backToHome}>
        <View
          className="items-center gap-4 rounded-[20px] bg-surface px-6 py-10"
          style={cardShadow}>
          <Ionicons name="help-circle" size={36} color={colors.ink.muted} />
          <Text className="text-center text-sm leading-5 text-ink-soft">
            {t.swap.statusNotFound}
          </Text>
          <Pressable
            onPress={backToHome}
            accessibilityRole="button"
            className="rounded-full bg-primary-500 px-6 py-3 active:opacity-80">
            <Text className="font-semibold text-white">{t.send.doneToHome}</Text>
          </Pressable>
        </View>
      </StackScreen>
    );
  }

  const confirmed = swap.status === 'confirmed';
  const fiat = (usd: number) => formatFiat(usd, displayCurrency, MOCK_FX_RATES);

  const copyHash = async () => {
    try {
      if (!(await Clipboard.setStringAsync(swap.txHash))) throw new Error('clipboard_rejected');
      toast({ title: t.send.txHashCopied, message: shortenAddress(swap.txHash, 10, 8) });
    } catch {
      toast({
        variant: 'error',
        title: t.receive.copyFailedTitle,
        message: t.receive.copyFailedMessage,
      });
    }
  };

  const openExplorer = () => {
    if (isDemo) {
      toast({ title: t.send.demoExplorerTitle, message: t.send.demoExplorerBody });
      return;
    }
    Linking.openURL(explorerTxUrl(fromNetwork.explorerUrl, swap.txHash)).catch(() => {});
  };

  let pendingBody = t.swap.statusPendingBody(swap.provider);
  if (swap.crossChain) pendingBody = t.swap.statusPendingBridge(swap.provider);

  return (
    <StackScreen title={t.swap.statusTitle} onBack={backToHome}>
      {isDemo && <DemoBanner message={t.swap.demoStatus} />}

      <View
        className="items-center rounded-[20px] bg-surface px-5 py-7"
        style={cardShadow}
        accessibilityLiveRegion="polite">
        <View
          className={`h-16 w-16 items-center justify-center rounded-full ${
            confirmed ? 'bg-success-50' : 'bg-primary-50'
          }`}>
          {confirmed ? (
            <Ionicons name="checkmark-circle" size={44} color={colors.success[500]} />
          ) : (
            <ActivityIndicator size="large" color={colors.primary[500]} />
          )}
        </View>
        <Text className="mt-4 text-xl font-bold text-ink" accessibilityRole="header">
          {confirmed ? t.swap.statusConfirmed : t.swap.statusPending}
        </Text>
        <Text className="mt-1.5 text-center text-[13px] leading-5 text-ink-muted">
          {confirmed ? t.swap.statusConfirmedBody : pendingBody}
        </Text>

        <View className="mt-5 w-full gap-3 rounded-2xl bg-subtle px-4 py-3.5">
          <Leg
            label={t.swap.swapped}
            symbol={swap.fromSymbol}
            network={fromNetwork}
            amount={swap.fromAmount}
          />
          <Ionicons
            name="arrow-down"
            size={16}
            color={colors.ink.faint}
            style={{ marginLeft: 10 }}
          />
          <Leg
            label={confirmed ? t.swap.received : t.swap.receivedEstimate}
            symbol={swap.toSymbol}
            network={toNetwork}
            amount={swap.toAmount}
            highlight={confirmed}
          />
        </View>
      </View>

      <View className="rounded-[20px] bg-surface px-4 py-1" style={cardShadow}>
        <ConfirmRow label={t.swap.rowRoute}>
          <Text className="text-sm font-semibold text-ink">
            {swap.crossChain ? t.swap.viaBridge(swap.provider) : t.swap.via(swap.provider)}
          </Text>
        </ConfirmRow>
        <ConfirmRow label={t.swap.rowMinReceived}>
          <Text className="text-sm font-semibold text-ink">
            {formatTokenAmount(swap.minReceived, true)} {swap.toSymbol}
          </Text>
          <Text className="text-xs text-ink-muted">
            {t.swap.rowSlippage} {swap.slippage}%
          </Text>
        </ConfirmRow>
        <ConfirmRow label={t.send.rowFee}>
          <Text className="text-sm font-semibold text-ink">
            ≈ {formatTokenAmount(swap.feeNative, false)} {fromNetwork.nativeSymbol}
          </Text>
          <Text className="text-xs text-ink-muted">≈ {fiat(swap.feeUsd + swap.bridgeFeeUsd)}</Text>
        </ConfirmRow>
        <ConfirmRow label={t.send.rowTime}>
          <Text className="text-sm font-semibold text-ink">{formatTime(swap.createdAt)}</Text>
        </ConfirmRow>
        <ConfirmRow label={t.send.rowTxHash} isLast>
          <Pressable
            onPress={copyHash}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t.send.copyTxHash}
            className="flex-row items-center gap-1.5 active:opacity-70">
            <Text className="text-[13px] font-semibold text-ink" style={{ fontFamily: monoFont }}>
              {shortenAddress(swap.txHash, 8, 6)}
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

      <View className="gap-3">
        <Pressable
          onPress={backToHome}
          accessibilityRole="button"
          className="items-center rounded-full bg-primary-500 py-4 active:opacity-80">
          <Text className="text-base font-semibold text-white">{t.send.doneToHome}</Text>
        </Pressable>
        <Pressable
          onPress={swapAgain}
          accessibilityRole="button"
          className="items-center rounded-full bg-primary-50 py-4 active:opacity-70">
          <Text className="text-base font-semibold text-primary-500">{t.swap.swapAgain}</Text>
        </Pressable>
      </View>
    </StackScreen>
  );
}

function Leg({
  label,
  symbol,
  network,
  amount,
  highlight,
}: {
  label: string;
  symbol: string;
  network: Network;
  amount: number;
  highlight?: boolean;
}) {
  const { formatTokenAmount } = useFormat();
  return (
    <View className="flex-row items-center gap-3">
      <TokenNetworkIcon symbol={symbol} networkId={network.id} size={34} />
      <View className="flex-1">
        <Text className="text-[11px] text-ink-muted">{label}</Text>
        <Text
          className={`text-base font-bold ${highlight ? 'text-success-600' : 'text-ink'}`}
          style={{ fontVariant: ['tabular-nums'] }}>
          {formatTokenAmount(amount, true)} {symbol}
        </Text>
      </View>
      <View className="flex-row items-center gap-1">
        <NetworkIcon networkId={network.id} size={12} />
        <Text className="text-xs font-semibold text-ink-soft">{network.name}</Text>
      </View>
    </View>
  );
}
