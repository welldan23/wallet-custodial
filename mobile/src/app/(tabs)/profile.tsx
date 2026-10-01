import { ComingSoon } from '@/components/ui/coming-soon';
import { useI18n } from '@/i18n';

export default function ProfileScreen() {
  const { t } = useI18n();
  return <ComingSoon title={t.tabs.profile} />;
}
