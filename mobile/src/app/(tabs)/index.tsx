import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AssetSection } from '@/components/home/asset-section';
import { BalanceCard } from '@/components/home/balance-card';
import { HomeHeader } from '@/components/home/home-header';
import { QuickActions } from '@/components/home/quick-actions';
import { ScreenBackground } from '@/components/ui/screen-background';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useI18n } from '@/i18n';
import type { FiatCurrency } from '@/types/wallet';

/** Mata uang pendamping USD. Nanti diambil dari Pengaturan. */
const DISPLAY_CURRENCY: FiatCurrency = 'IDR';

export default function HomeScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { portfolio, fxRates } = usePortfolio();
  const [balanceHidden, setBalanceHidden] = useState(false);

  return (
    <View className="flex-1 bg-canvas">
      <ScreenBackground />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}>
        <View className="w-full max-w-[520px] gap-5 self-center px-5">
          <HomeHeader />
          <BalanceCard
            totalUsd={portfolio.totalUsd}
            currency={DISPLAY_CURRENCY}
            fxRates={fxRates}
            hidden={balanceHidden}
            onToggleHidden={() => setBalanceHidden((hidden) => !hidden)}
          />
          <QuickActions />
          <AssetSection
            title={t.home.stablecoinAssets}
            assets={portfolio.stablecoins}
            currency={DISPLAY_CURRENCY}
            fxRates={fxRates}
            hidden={balanceHidden}
          />
          <AssetSection
            title={t.home.gasCoins}
            subtitle={t.home.gasCoinsHint}
            assets={portfolio.gasCoins}
            currency={DISPLAY_CURRENCY}
            fxRates={fxRates}
            hidden={balanceHidden}
          />
        </View>
      </ScrollView>
    </View>
  );
}
