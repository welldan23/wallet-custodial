import { OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { ComingSoonCard } from '@/components/ui/coming-soon-card';
import { useI18n } from '@/i18n';

/** Sementara: isi layar ini dibuat di task berikutnya. */
export default function OnboardingPlaceholder() {
  const { t } = useI18n();
  return (
    <OnboardingScreen title={t.onboarding.importWallet} step={{ current: 1, total: 3 }}>
      <ComingSoonCard />
    </OnboardingScreen>
  );
}
