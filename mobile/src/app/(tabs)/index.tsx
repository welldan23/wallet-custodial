import { router, type Href } from 'expo-router';

import { AssetSection } from '@/components/home/asset-section';
import { BalanceCard } from '@/components/home/balance-card';
import { EmptyAssets } from '@/components/home/empty-assets';
import { QuickActions, type QuickAction } from '@/components/home/quick-actions';
import { TabScreen } from '@/components/layout/tab-screen';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useI18n } from '@/i18n';
import type { FiatCurrency } from '@/types/wallet';

/** Mata uang pendamping USD. Nanti diambil dari Pengaturan. */
const DISPLAY_CURRENCY: FiatCurrency = 'IDR';

const QUICK_ACTION_ROUTES: Record<QuickAction, Href> = {
  send: '/send',
  receive: '/receive',
  swap: '/swap',
};

const openPortfolio = () => router.navigate('/portfolio');
const openQuickAction = (action: QuickAction) => router.push(QUICK_ACTION_ROUTES[action]);

export default function HomeScreen() {
  const { t } = useI18n();
  const { portfolio, networks, fxRates, pricesUpdatedAt } = usePortfolio();
  const { hidden: balanceHidden, toggleHidden } = useBalanceVisibility();

  return (
    <TabScreen active="home">
      <BalanceCard
        totalUsd={portfolio.totalUsd}
        currency={DISPLAY_CURRENCY}
        fxRates={fxRates}
        pricesUpdatedAt={pricesUpdatedAt}
        hidden={balanceHidden}
        onToggleHidden={toggleHidden}
        onPressDetail={openPortfolio}
      />
      <QuickActions onPress={openQuickAction} />

      {portfolio.isEmpty ? (
        <EmptyAssets networks={networks} onReceive={() => openQuickAction('receive')} />
      ) : (
        <>
          <AssetSection
            title={t.home.stablecoinAssets}
            assets={portfolio.stablecoins}
            currency={DISPLAY_CURRENCY}
            fxRates={fxRates}
            hidden={balanceHidden}
            emptyText={t.home.emptyStablecoins}
            onSeeAll={openPortfolio}
          />
          <AssetSection
            title={t.home.gasCoins}
            subtitle={t.home.gasCoinsHint}
            assets={portfolio.gasCoins}
            currency={DISPLAY_CURRENCY}
            fxRates={fxRates}
            hidden={balanceHidden}
            emptyText={t.home.emptyGasCoins}
          />
        </>
      )}
    </TabScreen>
  );
}
