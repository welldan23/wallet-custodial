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
import { useSentTransfers } from '@/hooks/use-sent-transfers';
import { useSupportedNetworks } from '@/hooks/use-supported-networks';
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

const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Balik ke Home: tutup semua layar Kirim supaya tidak bisa "kembali" ke konfirmasi. */
const backToHome = () => router.dismissTo('/');
const sendAgain = () => {
  backToHome();
  router.push('/send');
};

/** Status kiriman setelah disetujui: menunggu konfirmasi → terkirim. */
export default function SendStatusScreen() {
  const colors = useThemeColors();
  const { formatFiat, formatTokenAmount } = useFormat();
  const displayCurrency = useDisplayCurrency();
  const { t } = useI18n();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { transfers } = useSentTransfers();
  const isDemo = useSimulatedTransactions();
  const networks = useSupportedNetworks();

  const transfer = transfers.find((item) => item.id === id);
  const network = networks.find((item) => item.network.id === transfer?.networkId)?.network;

  if (!transfer || !network) {
    return (
      <StackScreen title={t.send.statusTitle} onBack={backToHome}>
        <View
          className="items-center gap-4 rounded-[20px] bg-surface px-6 py-10"
          style={cardShadow}>
          <Ionicons name="help-circle" size={36} color={colors.ink.muted} />
          <Text className="text-center text-sm leading-5 text-ink-soft">
            {t.send.statusNotFound}
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

  const confirmed = transfer.status === 'confirmed';
  const fiat = (usd: number) => formatFiat(usd, displayCurrency, MOCK_FX_RATES);
  const amountLabel = `${formatTokenAmount(transfer.amount, transfer.isStablecoin)} ${transfer.symbol}`;

  const copyHash = async () => {
    try {
      if (!(await Clipboard.setStringAsync(transfer.txHash))) throw new Error('clipboard_rejected');
      toast({ title: t.send.txHashCopied, message: shortenAddress(transfer.txHash, 10, 8) });
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
    Linking.openURL(explorerTxUrl(network.explorerUrl, transfer.txHash)).catch(() => {});
  };

  return (
    <StackScreen title={t.send.statusTitle} onBack={backToHome}>
      {isDemo && <DemoBanner message={t.send.demoStatus} />}

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
          {confirmed ? t.send.statusConfirmed : t.send.statusPending}
        </Text>
        <Text className="mt-1.5 text-center text-[13px] leading-5 text-ink-muted">
          {confirmed ? t.send.statusConfirmedBody : t.send.statusPendingBody(network.name)}
        </Text>

        <View className="mt-5 flex-row items-center gap-3">
          <TokenNetworkIcon symbol={transfer.symbol} networkId={network.id} size={40} />
          <View>
            <Text
              className="text-[22px] font-bold text-ink"
              style={{ fontVariant: ['tabular-nums'] }}>
              {amountLabel}
            </Text>
            <Text className="text-[13px] font-semibold text-ink-muted">
              ≈ {fiat(transfer.amountUsd)}
            </Text>
          </View>
        </View>
      </View>

      <View className="rounded-[20px] bg-surface px-4 py-1" style={cardShadow}>
        <ConfirmRow label={t.send.rowTo} hint={transfer.contact}>
          <Text
            selectable
            className="text-right text-[13px] font-semibold text-ink"
            style={{ fontFamily: monoFont }}>
            {shortenAddress(transfer.to, 8, 6)}
          </Text>
        </ConfirmRow>
        <ConfirmRow label={t.send.rowNetwork}>
          <View className="flex-row items-center gap-1.5">
            <NetworkIcon networkId={network.id} size={16} />
            <Text className="text-sm font-semibold text-ink">{network.name}</Text>
          </View>
        </ConfirmRow>
        <ConfirmRow label={t.send.rowFee}>
          <Text className="text-sm font-semibold text-ink">
            ≈ {formatTokenAmount(transfer.feeNative, false)} {network.nativeSymbol}
          </Text>
          <Text className="text-xs text-ink-muted">≈ {fiat(transfer.feeUsd)}</Text>
        </ConfirmRow>
        <ConfirmRow label={t.send.rowTime}>
          <Text className="text-sm font-semibold text-ink">{formatTime(transfer.createdAt)}</Text>
        </ConfirmRow>
        <ConfirmRow label={t.send.rowTxHash} isLast>
          <Pressable
            onPress={copyHash}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t.send.copyTxHash}
            className="flex-row items-center gap-1.5 active:opacity-70">
            <Text className="text-[13px] font-semibold text-ink" style={{ fontFamily: monoFont }}>
              {shortenAddress(transfer.txHash, 8, 6)}
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
          onPress={sendAgain}
          accessibilityRole="button"
          className="items-center rounded-full bg-primary-50 py-4 active:opacity-70">
          <Text className="text-base font-semibold text-primary-500">{t.send.sendAgain}</Text>
        </Pressable>
      </View>
    </StackScreen>
  );
}
