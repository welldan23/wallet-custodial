import { StackScreen } from '@/components/layout/stack-screen';
import { ComingSoonCard } from '@/components/ui/coming-soon-card';
import { useI18n } from '@/i18n';

/** Sementara: form tambah kontak dibuat di task berikutnya. */
export default function NewContactPlaceholder() {
  const { t } = useI18n();
  return (
    <StackScreen title={t.contacts.add}>
      <ComingSoonCard />
    </StackScreen>
  );
}
