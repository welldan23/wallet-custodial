import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { StackScreen } from '@/components/layout/stack-screen';
import { SwapAssetCard } from '@/components/swap/swap-asset-card';
import { DemoBanner } from '@/components/ui/demo-banner';
import { useToast } from '@/components/ui/toast';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { defaultSwapPair, useSwapAssets } from '@/hooks/use-swap-assets';
import { useWalletAccounts } from '@/hooks/use-wallet-accounts';
import { useI18n } from '@/i18n';
import { checkAmount, formatAmountForInput } from '@/lib/amount';
import { formatFiat, formatNumber, formatTokenAmount } from '@/lib/format';
import { getMockSwapQuote } from '@/mocks/swap';
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
  const toast = useToast();
  const assets = useSwapAssets();
  const { isDemo } = useWalletAccounts();
  const { hidden } = useBalanceVisibility();
  const [initialPair] = useState(() => defaultSwapPair(assets));
  const [fromId, setFromId] = useState(initialPair?.from.tokenId);
  const [toId, setToId] = useState(initialPair?.to.tokenId);
  const [amountInput, setAmountInput] = useState('');

  const from = assets.find((asset) => asset.tokenId === fromId);
  const to = assets.find((asset) => asset.tokenId === toId);

  if (!from || !to) {
    return (
      <StackScreen title={t.swap.title}>
        <View className="items-center gap-3 rounded-[20px] bg-surface px-6 py-10" style={cardShadow}>
          <Ionicons name="swap-vertical" size={36} color={colors.ink.faint} />
          <Text className="text-center text-sm leading-5 text-ink-soft">{t.swap.unavailable}</Text>
        </View>
      </StackScreen>
    );
  }

  const fiat = (usd: number) => formatFiat(usd, DISPLAY_CURRENCY, MOCK_FX_RATES);
  const check = checkAmount(amountInput, from.balance, from.decimals);
  const amount = check.status === 'valid' ? check.amount : 0;
  const quote = getMockSwapQuote({
    fromSymbol: from.symbol,
    toSymbol: to.symbol,
    fromNetwork: from.network,
    toNetwork: to.network,
    amount,
  });
  const canReview = check.status === 'valid' && quote !== null;

  const flip = () => {
    setFromId(to.tokenId);
    setToId(from.tokenId);
    // Jumlah dikosongkan: saldo koin asal yang baru bisa beda jauh.
    setAmountInput('');
  };

  const review = () =>
    toast({ title: t.swap.reviewSoonTitle, message: t.swap.reviewSoonBody });

  return (
    <StackScreen title={t.swap.title}>
      {isDemo && <DemoBanner message={t.swap.demoWarning} />}

      <View>
        <SwapAssetCard
          label={t.swap.fromLabel}
          asset={from}
          hidden={hidden}
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
          editable={false}
          value={amount > 0 && quote ? formatTokenAmount(quote.toAmount, true) : ''}
          caption={amount > 0 && quote ? `≈ ${fiat(quote.toAmount * to.usdPrice)}` : t.swap.estimateHint}
        />
      </View>

      {quote && (
        <View className="flex-row items-center justify-between gap-3 px-1">
          <Text className="flex-1 text-xs text-ink-muted" style={{ fontVariant: ['tabular-nums'] }}>
            {t.swap.rate(from.symbol, formatNumber(quote.rate, { maximumFractionDigits: 4 }), to.symbol)}
          </Text>
          <View className="flex-row items-center gap-1 rounded-full bg-surface px-2.5 py-1">
            <Ionicons name="git-branch-outline" size={12} color={colors.ink.muted} />
            <Text className="text-[11px] font-semibold text-ink-soft">
              {quote.crossChain ? t.swap.viaBridge(quote.provider) : t.swap.via(quote.provider)}
            </Text>
          </View>
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
    </StackScreen>
  );
}
