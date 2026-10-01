import { StackScreen } from '@/components/layout/stack-screen';
import { ComingSoonCard } from '@/components/ui/coming-soon-card';
import { useI18n } from '@/i18n';

export default function SwapScreen() {
  const { t } = useI18n();
  return (
    <StackScreen title={t.swap.title}>
      <ComingSoonCard description={t.swap.preview} />
    </StackScreen>
  );
}
