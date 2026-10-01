import { StackScreen } from '@/components/layout/stack-screen';
import { ComingSoonCard } from '@/components/ui/coming-soon-card';
import { useI18n } from '@/i18n';

export default function SendScreen() {
  const { t } = useI18n();
  return (
    <StackScreen title={t.send.title}>
      <ComingSoonCard description={t.send.preview} />
    </StackScreen>
  );
}
