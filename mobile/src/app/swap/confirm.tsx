import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { TokenNetworkIcon } from '@/components/crypto/token-network-icon';
import { StackScreen } from '@/components/layout/stack-screen';
import { DemoAuthSheet } from '@/components/send/demo-auth-sheet';
import { SwapDetailsCard } from '@/components/swap/swap-details-card';
import { useToast } from '@/components/ui/toast';
import { useSwapAssets, type SwapAsset } from '@/hooks/use-swap-assets';
import { useSwapGas } from '@/hooks/use-swap-quote';
import { useSwaps } from '@/hooks/use-swaps';
import { useSimulatedTransactions } from '@/hooks/use-simulated-transactions';
import { useDisplayCurrency } from '@/hooks/use-settings';
import { useFormat } from '@/hooks/use-format';
import { useI18n } from '@/i18n';
import { checkAmount } from '@/lib/amount';
import { authorizeSigning } from '@/lib/biometric';
import { checkSlippage, minReceived } from '@/lib/slippage';
import { getMockSwapQuote, type SwapQuote } from '@/mocks/swap';
import { MOCK_FX_RATES } from '@/mocks/wallet';
import { cardShadow, colors } from '@/theme/colors';

/** Kurs dari agregator cuma berlaku sebentar; setelah itu wajib diperbarui. */
const QUOTE_TTL_SECONDS = 30;

/** Format USD ke mata uang tampilan dari Pengaturan. */
function useFiat() {
  const { formatFiat } = useFormat();
  const displayCurrency = useDisplayCurrency();
  return (usd: number) => formatFiat(usd, displayCurrency, MOCK_FX_RATES);
}

/**
 * Konfirmasi swap: rincian lengkap dari kurs terbaru. Data dari URL
 * divalidasi ulang di sini; kurs kedaluwarsa setelah 30 detik.
 */
export default function ConfirmSwapScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{
    from?: string;
    to?: string;
    amount?: string;
    slippage?: string;
  }>();
  const assets = useSwapAssets();

  const from = assets.find((asset) => asset.tokenId === params.from);
  const to = assets.find((asset) => asset.tokenId === params.to);
  const amount = from ? checkAmount(params.amount ?? '', from.balance, from.decimals) : null;
  const slippage = checkSlippage(params.slippage ?? '');

  if (
    !from ||
    !to ||
    from.tokenId === to.tokenId ||
    amount?.status !== 'valid' ||
    slippage.status !== 'valid'
  ) {
    return (
      <StackScreen title={t.swap.confirmTitle}>
        <View
          className="items-center gap-4 rounded-[20px] bg-surface px-6 py-10"
          style={cardShadow}>
          <Ionicons name="alert-circle" size={36} color={colors.danger[500]} />
          <Text className="text-center text-sm leading-5 text-ink-soft">{t.swap.invalidDraft}</Text>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/swap'))}
            accessibilityRole="button"
            className="rounded-full bg-primary-500 px-6 py-3 active:opacity-80">
            <Text className="font-semibold text-white">{t.send.backToForm}</Text>
          </Pressable>
        </View>
      </StackScreen>
    );
  }

  return <SwapConfirmation from={from} to={to} amount={amount.amount} slippage={slippage.value} />;
}

type SwapConfirmationProps = {
  from: SwapAsset;
  to: SwapAsset;
  amount: number;
  slippage: number;
};

const fetchQuote = (from: SwapAsset, to: SwapAsset, amount: number) =>
  getMockSwapQuote({
    fromSymbol: from.symbol,
    toSymbol: to.symbol,
    fromNetwork: from.network,
    toNetwork: to.network,
    amount,
  });

function SwapConfirmation({ from, to, amount, slippage }: SwapConfirmationProps) {
  const { formatTokenAmount } = useFormat();
  const fiat = useFiat();
  const { t } = useI18n();
  const toast = useToast();
  const [quote, setQuote] = useState<SwapQuote | null>(() => fetchQuote(from, to, amount));
  const [secondsLeft, setSecondsLeft] = useState(QUOTE_TTL_SECONDS);
  const [authorizing, setAuthorizing] = useState(false);
  const [demoAuthOpen, setDemoAuthOpen] = useState(false);
  const isDemo = useSimulatedTransactions();
  const { recordSwap } = useSwaps();
  const { nativeSymbol, networkFeeNative, hasEnoughGas } = useSwapGas(from, quote);
  const expired = secondsLeft <= 0;
  const canConfirm = quote !== null && hasEnoughGas && !expired && !authorizing;

  useEffect(() => {
    if (expired) return;
    const timer = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [expired]);

  const refresh = () => {
    setQuote(fetchQuote(from, to, amount));
    setSecondsLeft(QUOTE_TTL_SECONDS);
  };

  /**
   * Setelah lolos verifikasi: catat swap lalu ganti layar ini dengan status.
   * Mode demo belum memanggil agregator — swapnya tiruan.
   */
  const onAuthorized = () => {
    setDemoAuthOpen(false);
    if (!quote) return;
    const swap = recordSwap(
      {
        fromTokenId: from.tokenId,
        fromSymbol: from.symbol,
        fromNetworkId: from.network.id,
        fromAmount: amount,
        toTokenId: to.tokenId,
        toSymbol: to.symbol,
        toNetworkId: to.network.id,
        toAmount: quote.toAmount,
        minReceived: minReceived(quote.toAmount, slippage),
        slippage,
        provider: quote.provider,
        crossChain: quote.crossChain,
        feeNative: networkFeeNative,
        feeUsd: quote.networkFeeUsd,
        bridgeFeeUsd: quote.bridgeFeeUsd,
        amountUsd: amount * from.usdPrice,
      },
      from.network.chainType,
    );
    router.replace({ pathname: '/swap/status', params: { id: swap.id } });
  };

  const confirm = async () => {
    setAuthorizing(true);
    const result = await authorizeSigning(
      t.swap.biometricPrompt(formatTokenAmount(amount, true), from.symbol, to.symbol),
      t.common.cancel,
    );
    setAuthorizing(false);
    if (result === 'success') return onAuthorized();
    if (result === 'unsupported' && isDemo) return setDemoAuthOpen(true);
    toast({
      variant: 'error',
      title: t.send.authError[result].title,
      message: result === 'cancelled' ? t.swap.cancelled : t.send.authError[result].body,
    });
  };

  return (
    <StackScreen title={t.swap.confirmTitle}>
      <View className="rounded-[20px] bg-surface px-5 py-5" style={cardShadow}>
        <SwapLeg label={t.swap.youPay} asset={from} amount={amount} />
        <View className="my-1 ml-[18px] h-6 w-0.5 bg-line" />
        <SwapLeg label={t.swap.youGetEstimate} asset={to} amount={quote?.toAmount ?? 0} highlight />
      </View>

      <SwapDetailsCard
        from={from}
        to={to}
        quote={quote}
        loading={false}
        networkFeeNative={networkFeeNative}
        nativeSymbol={nativeSymbol}
        fiat={fiat}
        slippage={slippage}
      />

      {!hasEnoughGas && (
        <View
          className="flex-row items-start gap-2 rounded-2xl border border-danger-500/40 bg-danger-50 px-4 py-3.5"
          accessibilityRole="alert">
          <Ionicons name="close-circle" size={18} color={colors.danger[600]} />
          <Text className="flex-1 text-[13px] leading-5 text-danger-600">
            {t.send.notEnoughGasBody(formatTokenAmount(networkFeeNative, false), nativeSymbol)}
          </Text>
        </View>
      )}

      <View
        className={`flex-row items-center gap-3 rounded-2xl px-4 py-3 ${
          expired ? 'bg-warning-50' : 'bg-surface'
        }`}
        accessibilityLiveRegion="polite">
        <Ionicons
          name={expired ? 'time' : 'time-outline'}
          size={18}
          color={expired ? colors.warning[600] : colors.ink.muted}
        />
        <Text
          className={`flex-1 text-[13px] ${expired ? 'font-semibold text-warning-600' : 'text-ink-muted'}`}>
          {expired ? t.swap.quoteExpired : t.swap.quoteValidFor(secondsLeft)}
        </Text>
        <Pressable
          onPress={refresh}
          accessibilityRole="button"
          accessibilityLabel={t.swap.refreshQuote}
          className="flex-row items-center gap-1 rounded-full bg-primary-50 px-3 py-1.5 active:opacity-70">
          <Ionicons name="refresh" size={14} color={colors.primary[500]} />
          <Text className="text-xs font-bold text-primary-500">{t.swap.refreshQuote}</Text>
        </Pressable>
      </View>

      <View className="flex-row items-start gap-2 px-1">
        <Ionicons name="information-circle-outline" size={16} color={colors.ink.muted} />
        <Text className="flex-1 text-xs leading-[18px] text-ink-muted">
          {quote?.crossChain ? t.swap.bridgeIrreversible : t.swap.irreversible}
        </Text>
      </View>

      <Pressable
        onPress={confirm}
        disabled={!canConfirm}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canConfirm, busy: authorizing }}
        className={`flex-row items-center justify-center gap-2 rounded-full py-4 ${
          canConfirm ? 'bg-primary-500 active:opacity-80' : 'bg-line'
        }`}>
        <Ionicons
          name="finger-print"
          size={20}
          color={canConfirm ? colors.surface : colors.ink.faint}
        />
        <Text className={`text-base font-semibold ${canConfirm ? 'text-white' : 'text-ink-faint'}`}>
          {authorizing ? t.send.authorizing : t.swap.confirmSwap}
        </Text>
      </Pressable>

      <DemoAuthSheet
        visible={demoAuthOpen}
        onClose={() => setDemoAuthOpen(false)}
        onApprove={onAuthorized}
      />
    </StackScreen>
  );
}

/** Satu sisi swap: logo, jumlah, simbol, jaringan, dan nilai Rupiah. */
function SwapLeg({
  label,
  asset,
  amount,
  highlight,
}: {
  label: string;
  asset: SwapAsset;
  amount: number;
  highlight?: boolean;
}) {
  const { formatTokenAmount } = useFormat();
  const fiat = useFiat();
  return (
    <View className="flex-row items-center gap-3">
      <TokenNetworkIcon symbol={asset.symbol} networkId={asset.network.id} size={40} />
      <View className="flex-1">
        <Text className="text-xs text-ink-muted">{label}</Text>
        <Text
          className={`text-[22px] font-bold ${highlight ? 'text-success-600' : 'text-ink'}`}
          style={{ fontVariant: ['tabular-nums'] }}>
          {formatTokenAmount(amount, true)} {asset.symbol}
        </Text>
        <View className="flex-row items-center gap-1">
          <NetworkIcon networkId={asset.network.id} size={12} />
          <Text className="text-xs font-semibold text-ink-soft">{asset.network.name}</Text>
          <Text className="text-xs text-ink-muted"> · ≈ {fiat(amount * asset.usdPrice)}</Text>
        </View>
      </View>
    </View>
  );
}
