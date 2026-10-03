import { router, type Href } from 'expo-router';
import { useState } from 'react';

import { AssetSection } from '@/components/home/asset-section';
import { BalanceCard } from '@/components/home/balance-card';
import { EmptyAssets } from '@/components/home/empty-assets';
import { GasBalanceCard } from '@/components/home/gas-balance-card';
import { QuickActions, type QuickAction } from '@/components/home/quick-actions';
import { RecentActivityCard } from '@/components/home/recent-activity-card';
import { TabScreen } from '@/components/layout/tab-screen';
import { useBalanceVisibility } from '@/hooks/use-balance-visibility';
import { useGasSummary } from '@/hooks/use-gas-summary';
import { usePortfolio } from '@/hooks/use-portfolio';
import { useActivity, type ActivityItem } from '@/hooks/use-activity';
import { useDisplayCurrency } from '@/hooks/use-settings';
import { useFormat } from '@/hooks/use-format';
import { useI18n } from '@/i18n';
import type { Dictionary } from '@/i18n/id';
import { shortenAddress } from '@/lib/address';
import { MASKED_VALUE, type Formatter } from '@/lib/format';
import type { Network, NetworkId } from '@/types/wallet';

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

const openActivity = (item: ActivityItem) =>
  router.push({
    pathname: item.kind === 'swap' ? '/swap/status' : '/send/status',
    params: { id: item.id },
  });

/** Judul + keterangan kartu aktivitas terakhir. */
function describeActivity(
  item: ActivityItem,
  t: Dictionary,
  networkName: (id: NetworkId) => string,
  hidden: boolean,
  formatTokenAmount: Formatter['formatTokenAmount'],
) {
  const confirmed = item.status === 'confirmed';
  if (item.kind === 'swap') {
    const amount = hidden ? MASKED_VALUE : formatTokenAmount(item.fromAmount, true);
    return {
      title: confirmed
        ? t.home.swapConfirmed(item.fromSymbol, item.toSymbol)
        : t.home.swapPending(amount, item.fromSymbol, item.toSymbol),
      subtitle:
        item.fromNetworkId === item.toNetworkId
          ? networkName(item.fromNetworkId)
          : `${networkName(item.fromNetworkId)} → ${networkName(item.toNetworkId)}`,
    };
  }
  const amount = hidden ? MASKED_VALUE : formatTokenAmount(item.amount, item.isStablecoin);
  return {
    title: confirmed
      ? t.home.transferConfirmed(amount, item.symbol)
      : t.home.transferPending(amount, item.symbol),
    subtitle: t.home.transferTo(
      item.contact ?? shortenAddress(item.to),
      networkName(item.networkId),
    ),
  };
}

export default function HomeScreen() {
  const { t } = useI18n();
  const displayCurrency = useDisplayCurrency();
  const { formatTokenAmount } = useFormat();
  const { portfolio, networks, fxRates, pricesUpdatedAt } = usePortfolio();
  const gas = useGasSummary();
  const { hidden: balanceHidden, toggleHidden } = useBalanceVisibility();
  const activity = useActivity();
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  // Aktivitas terakhir tampil sampai ditutup; yang masih diproses tidak bisa ditutup.
  const latest = activity[0];
  const networkName = (id: NetworkId) =>
    networks.find((network: Network) => network.id === id)?.name ?? id;
  const latestText =
    latest && describeActivity(latest, t, networkName, balanceHidden, formatTokenAmount);

  return (
    <TabScreen active="home">
      <BalanceCard
        totalUsd={portfolio.totalUsd}
        currency={displayCurrency}
        fxRates={fxRates}
        pricesUpdatedAt={pricesUpdatedAt}
        hidden={balanceHidden}
        onToggleHidden={toggleHidden}
        onPressDetail={openPortfolio}
      />
      <QuickActions onPress={openQuickAction} />

      {latest && latestText && latest.id !== dismissedId && (
        <RecentActivityCard
          confirmed={latest.status === 'confirmed'}
          title={latestText.title}
          subtitle={latestText.subtitle}
          onOpen={() => openActivity(latest)}
          onDismiss={() => setDismissedId(latest.id)}
        />
      )}

      {portfolio.isEmpty ? (
        <EmptyAssets networks={networks} onReceive={() => openQuickAction('receive')} />
      ) : (
        <>
          <AssetSection
            title={t.home.stablecoinAssets}
            assets={portfolio.stablecoins}
            currency={displayCurrency}
            fxRates={fxRates}
            hidden={balanceHidden}
            emptyText={t.home.emptyStablecoins}
            onSeeAll={openPortfolio}
          />
          <GasBalanceCard
            summary={gas}
            currency={displayCurrency}
            fxRates={fxRates}
            hidden={balanceHidden}
            onTopUp={topUpGas}
          />
        </>
      )}
    </TabScreen>
  );
}
