import { router, type Href } from 'expo-router';

import { AssetSection } from '@/components/home/asset-section';
import { BalanceCard } from '@/components/home/balance-card';
import { EmptyAssets } from '@/components/home/empty-assets';
import { GasBalanceCard } from '@/components/home/gas-balance-card';
import { QuickActions, type QuickAction } from '@/components/home/quick-actions';
import { TabScreen } from '@/components/layout/tab-screen';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { useGasSummary } from '@/hooks/use-gas-summary';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useI18n } from '@/i18n';
import type { FiatCurrency, NetworkId } from '@/types/wallet';

/** Mata uang pendamping USD. Nanti diambil dari Pengaturan. */
const DISPLAY_CURRENCY: FiatCurrency = 'IDR';

const QUICK_ACTION_ROUTES: Record<QuickAction, Href> = {
  send: '/send',
  receive: '/receive',
  swap: '/swap',
};

const openPortfolio = () => router.navigate('/portfolio');
const openQuickAction = (action: QuickAction) => router.push(QUICK_ACTION_ROUTES[action]);
/**
 * Isi gas = terima koin gas (mis. kirim POL dari exchange) di jaringan itu.
 * Bukan Swap, karena swap sendiri butuh gas di jaringan yang sedang kosong.
 */
const topUpGas = (networkId: NetworkId) =>
  router.push({ pathname: '/receive', params: { network: networkId } });

export default function HomeScreen() {
  const { t } = useI18n();
  const { portfolio, networks, fxRates, pricesUpdatedAt } = usePortfolio();
  const gas = useGasSummary();
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
          <GasBalanceCard
            summary={gas}
            currency={DISPLAY_CURRENCY}
            fxRates={fxRates}
            hidden={balanceHidden}
            onTopUp={topUpGas}
          />
        </>
      )}
    </TabScreen>
  );
}
