import { TabScreen } from '@/components/layout/tab-screen';
import { ComingSoonCard } from '@/components/ui/coming-soon-card';
import { useI18n } from '@/i18n';

export default function HistoryScreen() {
  const { t } = useI18n();
  return (
    <TabScreen active={'history'} title={t.tabs.history}>
      <ComingSoonCard />
    </TabScreen>
  );
}
