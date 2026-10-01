import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { StackScreen } from '@/components/layout/stack-screen';
import { SwapAssetCard } from '@/components/swap/swap-asset-card';
import { SwapAssetPickerSheet, type SwapSide } from '@/components/swap/swap-asset-picker-sheet';
import { SlippageSheet } from '@/components/swap/slippage-sheet';
import { SwapDetailsCard } from '@/components/swap/swap-details-card';
import { DemoBanner } from '@/components/ui/demo-banner';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { defaultSwapPair, useSwapAssets, type SwapAsset } from '@/hooks/use-swap-assets';
import { useSwapGas, useSwapQuote } from '@/hooks/use-swap-quote';
import { useWalletAccounts } from '@/hooks/use-wallet-accounts';
import { useI18n } from '@/i18n';
import { checkAmount, formatAmountForInput } from '@/lib/amount';
import { formatFiat, formatTokenAmount } from '@/lib/format';
import { DEFAULT_SLIPPAGE } from '@/lib/slippage';
import { MOCK_FX_RATES } from '@/mocks/wallet';
import { cardShadow, colors } from '@/theme/colors';
import type { FiatCurrency } from '@/types/wallet';

/** Mata uang pendamping USD. Nanti diambil dari Pengaturan. */
const DISPLAY_CURRENCY: FiatCurrency = 'IDR';

/**
 * Swap antar stablecoin: isi jumlah koin asal, lihat perkiraan koin tujuan.
 * Sementara kurs dari data tiruan; nanti rute dari LI.FI (EVM) / Jupiter (Solana).
 */
export default function SwapScreen() {
  const { t } = useI18n();
  const assets = useSwapAssets();
  const [initialPair] = useState(() => defaultSwapPair(assets));
  const [fromId, setFromId] = useState(initialPair?.from.tokenId);
  const [toId, setToId] = useState(initialPair?.to.tokenId);
  const [amountInput, setAmountInput] = useState('');

  const from = assets.find((asset) => asset.tokenId === fromId);
  const to = assets.find((asset) => asset.tokenId === toId);

  if (!from || !to) {
    return (
      <StackScreen title={t.swap.title}>
        <View
          className="items-center gap-3 rounded-[20px] bg-surface px-6 py-10"
          style={cardShadow}>
          <Ionicons name="swap-vertical" size={36} color={colors.ink.faint} />
          <Text className="text-center text-sm leading-5 text-ink-soft">{t.swap.unavailable}</Text>
        </View>
      </StackScreen>
    );
  }

  return (
    <SwapForm
      from={from}
      to={to}
      assets={assets}
      amountInput={amountInput}
      setAmountInput={setAmountInput}
      setFromId={setFromId}
      setToId={setToId}
    />
  );
}

type SwapFormProps = {
  from: SwapAsset;
  to: SwapAsset;
  assets: SwapAsset[];
  amountInput: string;
  setAmountInput: (value: string) => void;
  setFromId: (tokenId: string) => void;
  setToId: (tokenId: string) => void;
};

function SwapForm({
  from,
  to,
  assets,
  amountInput,
  setAmountInput,
  setFromId,
  setToId,
}: SwapFormProps) {
  const { t } = useI18n();
  const { isDemo } = useWalletAccounts();
  const { hidden } = useBalanceVisibility();
  const [picking, setPicking] = useState<SwapSide | null>(null);
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const [slippageOpen, setSlippageOpen] = useState(false);

  const fiat = (usd: number) => formatFiat(usd, DISPLAY_CURRENCY, MOCK_FX_RATES);
  const check = checkAmount(amountInput, from.balance, from.decimals);
  const amount = check.status === 'valid' ? check.amount : 0;
  const { quote, loading } = useSwapQuote(from, to, amount);
  const { nativeSymbol, networkFeeNative, hasEnoughGas } = useSwapGas(from, quote);
  const canReview = check.status === 'valid' && quote !== null && !loading && hasEnoughGas;

  const flip = () => {
    setFromId(to.tokenId);
    setToId(from.tokenId);
    // Jumlah dikosongkan: saldo koin asal yang baru bisa beda jauh.
    setAmountInput('');
  };

  /** Memilih koin yang sama dengan sisi seberang = tukar arah saja. */
  const selectAsset = (side: SwapSide, tokenId: string) => {
    const other = side === 'from' ? to : from;
    if (tokenId === other.tokenId) return flip();
    if (side === 'from') setFromId(tokenId);
    else setToId(tokenId);
  };

  const review = () =>
    router.push({
      pathname: '/swap/confirm',
      params: {
        from: from.tokenId,
        to: to.tokenId,
        amount: String(amount),
        slippage: String(slippage),
      },
    });

  return (
    <StackScreen title={t.swap.title}>
      {isDemo && <DemoBanner message={t.swap.demoWarning} />}

      <View>
        <SwapAssetCard
          label={t.swap.fromLabel}
          asset={from}
          hidden={hidden}
          onPickAsset={() => setPicking('from')}
          editable
          value={amountInput}
          onChange={setAmountInput}
          onMax={() => setAmountInput(formatAmountForInput(from.balance, from.decimals))}
          caption={
            check.status === 'invalid'
              ? t.send.amountError[check.reason]
              : `≈ ${fiat(amount * from.usdPrice)}`
          }
          captionIsError={check.status === 'invalid'}
        />

        {/* Tombol tukar arah, menumpuk di antara dua kartu */}
        <View className="z-10 -my-3.5 items-center" pointerEvents="box-none">
          <Pressable
            onPress={flip}
            accessibilityRole="button"
            accessibilityLabel={t.swap.flipLabel}
            className="h-11 w-11 items-center justify-center rounded-full border-4 border-canvas bg-primary-500 active:opacity-80">
            <Ionicons name="swap-vertical" size={20} color={colors.surface} />
          </Pressable>
        </View>

        <SwapAssetCard
          label={t.swap.toLabel}
          asset={to}
          hidden={hidden}
          onPickAsset={() => setPicking('to')}
          editable={false}
          value={quote ? formatTokenAmount(quote.toAmount, true) : loading ? '…' : ''}
          caption={
            quote
              ? `≈ ${fiat(quote.toAmount * to.usdPrice)}`
              : loading
                ? t.swap.findingRoute
                : t.swap.estimateHint
          }
        />
      </View>

      {amount > 0 && (
        <SwapDetailsCard
          from={from}
          to={to}
          quote={quote}
          loading={loading}
          networkFeeNative={networkFeeNative}
          nativeSymbol={nativeSymbol}
          fiat={fiat}
          slippage={slippage}
          onEditSlippage={() => setSlippageOpen(true)}
        />
      )}

      {!hasEnoughGas && (
        <View
          className="gap-2 rounded-2xl border border-danger-500/40 bg-danger-50 px-4 py-3.5"
          accessibilityRole="alert">
          <View className="flex-row items-center gap-2">
            <Ionicons name="close-circle" size={18} color={colors.danger[600]} />
            <Text className="flex-1 text-sm font-bold text-danger-600">
              {t.send.notEnoughGasTitle(nativeSymbol, from.network.name)}
            </Text>
          </View>
          <Text className="text-[13px] leading-5 text-ink-soft">
            {t.send.notEnoughGasBody(formatTokenAmount(networkFeeNative, false), nativeSymbol)}
          </Text>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/receive', params: { network: from.network.id } })
            }
            accessibilityRole="button"
            className="self-start rounded-full bg-surface px-4 py-2 active:opacity-70">
            <Text className="text-[13px] font-semibold text-primary-500">{t.send.topUpGas}</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={review}
        disabled={!canReview}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canReview }}
        className={`items-center rounded-full py-4 ${
          canReview ? 'bg-primary-500 active:opacity-80' : 'bg-line'
        }`}>
        <Text className={`text-base font-semibold ${canReview ? 'text-white' : 'text-ink-faint'}`}>
          {t.swap.review}
        </Text>
      </Pressable>

      <SwapAssetPickerSheet
        key={picking ?? 'closed'}
        side={picking}
        onClose={() => setPicking(null)}
        assets={assets}
        selected={picking === 'to' ? to : from}
        otherNetworkId={picking === 'to' ? from.network.id : to.network.id}
        otherTokenId={picking === 'to' ? from.tokenId : to.tokenId}
        hidden={hidden}
        onSelect={(tokenId) => picking && selectAsset(picking, tokenId)}
      />

      <SlippageSheet
        key={slippageOpen ? 'open' : 'closed'}
        visible={slippageOpen}
        onClose={() => setSlippageOpen(false)}
        value={slippage}
        onSave={setSlippage}
      />
    </StackScreen>
  );
}
