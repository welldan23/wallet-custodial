import { TabScreen } from '@/components/layout/tab-screen';
import { ComingSoonCard } from '@/components/ui/coming-soon-card';
import { useI18n } from '@/i18n';

export default function PortfolioScreen() {
  const { t } = useI18n();
  return (
    <TabScreen active={'portfolio'} title={t.tabs.portfolio}>
      <ComingSoonCard />
    </TabScreen>
  );
}
