import { OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { ComingSoonCard } from '@/components/ui/coming-soon-card';
import { useI18n } from '@/i18n';

/** Sementara: simpan aman + aktifkan biometrik dibuat di task berikutnya. */
export default function SecureWalletPlaceholder() {
  const { t } = useI18n();
  return (
    <OnboardingScreen title={t.onboarding.secureTitle} step={{ current: 3, total: 3 }}>
      <ComingSoonCard />
    </OnboardingScreen>
  );
}
