import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { NetworkIcon } from '@/components/crypto/network-icon';
import { TokenNetworkIcon } from '@/components/crypto/token-network-icon';
import { StackScreen } from '@/components/layout/stack-screen';
import { ConfirmRow } from '@/components/send/confirm-row';
import { DemoAuthSheet } from '@/components/send/demo-auth-sheet';
import { LookalikeWarning } from '@/components/send/lookalike-warning';
import { useToast } from '@/components/ui/toast';
import { useKnownAddresses } from '@/hooks/use-known-addresses';
import { useNetworkFee } from '@/hooks/use-network-fee';
import { useSentTransfers } from '@/hooks/use-sent-transfers';
import { useSendableAssets } from '@/hooks/use-sendable-assets';
import { useWalletAccounts } from '@/hooks/use-wallet-accounts';
import { useI18n } from '@/i18n';
import { groupAddress } from '@/lib/address';
import { validateRecipient } from '@/lib/address-validation';
import { checkAmount } from '@/lib/amount';
import { authorizeSigning } from '@/lib/biometric';
import { formatFiat, formatTokenAmount } from '@/lib/format';
import { recognizeRecipient } from '@/lib/lookalike';
import { buildSendQuote } from '@/lib/send-quote';
import { cardShadow, colors } from '@/theme/colors';
import type { FiatCurrency } from '@/types/wallet';

/** Mata uang pendamping USD. Nanti diambil dari Pengaturan. */
const DISPLAY_CURRENCY: FiatCurrency = 'IDR';
const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * Konfirmasi kiriman: jumlah, alamat lengkap, jaringan, dan biaya. Data dari
 * URL divalidasi ulang di sini — kalau tidak cocok, layar menolak lanjut.
 */
export default function ConfirmSendScreen() {
  const { t } = useI18n();
  const toast = useToast();
  const params = useLocalSearchParams<{
    token?: string;
    to?: string;
    amount?: string;
    contact?: string;
  }>();
  const { assets, fxRates } = useSendableAssets();
  const { accounts, isDemo } = useWalletAccounts();
  const [authorizing, setAuthorizing] = useState(false);
  const [demoAuthOpen, setDemoAuthOpen] = useState(false);
  const [lookalikeAcknowledged, setLookalikeAcknowledged] = useState(false);
  const knownAddresses = useKnownAddresses();
  const { recordTransfer } = useSentTransfers();

  const asset = assets.find((item) => item.tokenId === params.token) ?? null;
  const fee = useNetworkFee(asset?.network ?? null);
  const recipient = asset ? validateRecipient(params.to ?? '', asset.network, accounts) : null;
  const isNative = asset ? asset.symbol === asset.network.nativeSymbol : false;
  const amount = asset ? checkAmount(params.amount ?? '', asset.amount, asset.decimals) : null;

  if (!asset || !fee || recipient?.status !== 'valid' || amount?.status !== 'valid') {
    return (
      <StackScreen title={t.send.confirmTitle}>
        <View
          className="items-center gap-4 rounded-[20px] bg-surface px-6 py-10"
          style={cardShadow}>
          <Ionicons name="alert-circle" size={36} color={colors.danger[500]} />
          <Text className="text-center text-sm leading-5 text-ink-soft">{t.send.invalidDraft}</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            className="rounded-full bg-primary-500 px-6 py-3 active:opacity-80">
            <Text className="font-semibold text-white">{t.send.backToForm}</Text>
          </Pressable>
        </View>
      </StackScreen>
    );
  }

  const quote = buildSendQuote({
    amount: amount.amount,
    assetUsdPrice: fee.priceOf(asset.symbol),
    isNativeAsset: isNative,
    feeUsd: fee.feeUsd,
    nativeUsdPrice: fee.nativeUsdPrice,
    nativeBalance: fee.nativeBalance,
  });
  const groups = groupAddress(recipient.address);
  const recognition = recognizeRecipient(recipient.address, knownAddresses);
  const needsAcknowledge = recognition.kind === 'lookalike' && !lookalikeAcknowledged;
  const canSign = quote.hasEnoughGas && !authorizing && !needsAcknowledge;

  /**
   * Setelah lolos verifikasi: catat kiriman lalu ganti layar ini dengan
   * status, supaya tombol kembali tidak membuka konfirmasi lagi.
   * Mode demo belum menandatangani apa pun — kirimannya tiruan.
   */
  const onAuthorized = () => {
    setDemoAuthOpen(false);
    const transfer = recordTransfer(
      {
        tokenId: asset.tokenId,
        symbol: asset.symbol,
        isStablecoin: asset.isStablecoin,
        networkId: asset.network.id,
        amount: amount.amount,
        feeNative: quote.feeNative,
        feeUsd: quote.feeUsd,
        amountUsd: quote.amountUsd,
        to: recipient.address,
        contact: params.contact,
      },
      asset.network.chainType,
    );
    router.replace({ pathname: '/send/status', params: { id: transfer.id } });
  };

  const confirm = async () => {
    setAuthorizing(true);
    const result = await authorizeSigning(
      t.send.biometricPrompt(formatTokenAmount(amount.amount, asset.isStablecoin), asset.symbol),
      t.common.cancel,
    );
    setAuthorizing(false);
    if (result === 'success') return onAuthorized();
    if (result === 'unsupported' && isDemo) return setDemoAuthOpen(true);
    toast({
      variant: 'error',
      title: t.send.authError[result].title,
      message: t.send.authError[result].body,
    });
  };
  const fiat = (usd: number) => formatFiat(usd, DISPLAY_CURRENCY, fxRates);

  return (
    <StackScreen title={t.send.confirmTitle}>
      <View className="items-center rounded-[20px] bg-surface px-5 py-6" style={cardShadow}>
        <TokenNetworkIcon symbol={asset.symbol} networkId={asset.network.id} size={52} />
        <Text className="mt-3 text-[13px] text-ink-muted">{t.send.youSend}</Text>
        <Text
          className="mt-1 text-[30px] font-bold text-ink"
          style={{ fontVariant: ['tabular-nums'] }}>
          {formatTokenAmount(amount.amount, asset.isStablecoin)} {asset.symbol}
        </Text>
        <Text className="mt-1 text-sm font-semibold text-ink-muted">≈ {fiat(quote.amountUsd)}</Text>
      </View>

      <View className="rounded-[20px] bg-surface px-4 py-1" style={cardShadow}>
        <ConfirmRow label={t.send.rowTo} hint={params.contact}>
          <Text
            selectable
            className="text-right text-[13px] leading-5 text-ink-muted"
            style={{ fontFamily: monoFont }}>
            {groups.map((group, index) => {
              const first = groups[0] === '0x' ? 1 : 0;
              const strong = index <= first || index === groups.length - 1;
              return (
                <Text key={index} className={strong ? 'font-bold text-ink' : undefined}>
                  {group}
                  {index < groups.length - 1 ? ' ' : ''}
                </Text>
              );
            })}
          </Text>
        </ConfirmRow>
        <ConfirmRow label={t.send.rowNetwork}>
          <View className="flex-row items-center gap-1.5">
            <NetworkIcon networkId={asset.network.id} size={16} />
            <Text className="text-sm font-semibold text-ink">{asset.network.name}</Text>
          </View>
        </ConfirmRow>
        <ConfirmRow label={t.send.rowFee} hint={t.send.rowFeeHint(fee.nativeSymbol)}>
          <Text className="text-sm font-semibold text-ink">
            ≈ {formatTokenAmount(quote.feeNative, false)} {fee.nativeSymbol}
          </Text>
          <Text className="text-xs text-ink-muted">≈ {fiat(quote.feeUsd)}</Text>
        </ConfirmRow>
        <ConfirmRow label={t.send.rowTotal} isLast>
          <Text className="text-sm font-bold text-ink">≈ {fiat(quote.totalUsd)}</Text>
        </ConfirmRow>
      </View>

      {recognition.kind === 'lookalike' && (
        <LookalikeWarning
          recipient={recipient.address}
          match={recognition.match}
          acknowledged={lookalikeAcknowledged}
          onAcknowledge={setLookalikeAcknowledged}
        />
      )}

      {!quote.hasEnoughGas && (
        <View
          className="gap-2 rounded-2xl border border-danger-500/40 bg-danger-50 px-4 py-3.5"
          accessibilityRole="alert">
          <View className="flex-row items-center gap-2">
            <Ionicons name="close-circle" size={18} color={colors.danger[600]} />
            <Text className="flex-1 text-sm font-bold text-danger-600">
              {t.send.notEnoughGasTitle(fee.nativeSymbol, asset.network.name)}
            </Text>
          </View>
          <Text className="text-[13px] leading-5 text-ink-soft">
            {t.send.notEnoughGasBody(
              formatTokenAmount(quote.nativeNeeded, false),
              fee.nativeSymbol,
            )}
          </Text>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/receive', params: { network: asset.network.id } })
            }
            accessibilityRole="button"
            className="self-start rounded-full bg-surface px-4 py-2 active:opacity-70">
            <Text className="text-[13px] font-semibold text-primary-500">{t.send.topUpGas}</Text>
          </Pressable>
        </View>
      )}

      <View className="flex-row items-start gap-2 px-1">
        <Ionicons name="information-circle-outline" size={16} color={colors.ink.muted} />
        <Text className="flex-1 text-xs leading-[18px] text-ink-muted">{t.send.irreversible}</Text>
      </View>

      <Pressable
        onPress={confirm}
        disabled={!canSign}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSign, busy: authorizing }}
        className={`flex-row items-center justify-center gap-2 rounded-full py-4 ${
          canSign ? 'bg-primary-500 active:opacity-80' : 'bg-line'
        }`}>
        <Ionicons
          name="finger-print"
          size={20}
          color={canSign ? colors.surface : colors.ink.faint}
        />
        <Text className={`text-base font-semibold ${canSign ? 'text-white' : 'text-ink-faint'}`}>
          {authorizing ? t.send.authorizing : t.send.confirmSend}
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
