import { ComingSoon } from '@/components/ui/coming-soon';
import { useI18n } from '@/i18n';

export default function PortfolioScreen() {
  const { t } = useI18n();
  return <ComingSoon title={t.tabs.portfolio} active="portfolio" />;
}
