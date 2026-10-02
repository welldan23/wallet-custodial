import { Stack } from 'expo-router';

import { OnboardingDraftProvider } from '@/hooks/use-onboarding-draft';

/** Alur bikin/impor wallet: tanpa header bawaan, layar bergeser dari kanan. */
export default function OnboardingLayout() {
  return (
    <OnboardingDraftProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </OnboardingDraftProvider>
  );
}
