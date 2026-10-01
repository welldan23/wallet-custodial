import { router } from 'expo-router';
import { useState } from 'react';

import { AssetSection } from '@/components/home/asset-section';
import { BalanceCard } from '@/components/home/balance-card';
import { QuickActions } from '@/components/home/quick-actions';
import { TabScreen } from '@/components/layout/tab-screen';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useI18n } from '@/i18n';
import type { FiatCurrency } from '@/types/wallet';

/** Mata uang pendamping USD. Nanti diambil dari Pengaturan. */
const DISPLAY_CURRENCY: FiatCurrency = 'IDR';

const openPortfolio = () => router.navigate('/portfolio');

export default function HomeScreen() {
  const { t } = useI18n();
  const { portfolio, fxRates, pricesUpdatedAt } = usePortfolio();
  const [balanceHidden, setBalanceHidden] = useState(false);

  return (
    <TabScreen active="home">
      <BalanceCard
        totalUsd={portfolio.totalUsd}
        currency={DISPLAY_CURRENCY}
        fxRates={fxRates}
        pricesUpdatedAt={pricesUpdatedAt}
        hidden={balanceHidden}
        onToggleHidden={() => setBalanceHidden((hidden) => !hidden)}
        onPressDetail={openPortfolio}
      />
      <QuickActions />
      <AssetSection
        title={t.home.stablecoinAssets}
        assets={portfolio.stablecoins}
        currency={DISPLAY_CURRENCY}
        fxRates={fxRates}
        hidden={balanceHidden}
        onSeeAll={openPortfolio}
      />
      <AssetSection
        title={t.home.gasCoins}
        subtitle={t.home.gasCoinsHint}
        assets={portfolio.gasCoins}
        currency={DISPLAY_CURRENCY}
        fxRates={fxRates}
        hidden={balanceHidden}
      />
    </TabScreen>
  );
}
