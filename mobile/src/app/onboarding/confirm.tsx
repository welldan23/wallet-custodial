import { OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { ComingSoonCard } from '@/components/ui/coming-soon-card';
import { useI18n } from '@/i18n';

/** Sementara: konfirmasi catatan frasa dibuat di task berikutnya. */
export default function ConfirmMnemonicPlaceholder() {
  const { t } = useI18n();
  return (
    <OnboardingScreen title={t.onboarding.confirmTitle} step={{ current: 2, total: 3 }}>
      <ComingSoonCard />
    </OnboardingScreen>
  );
}
