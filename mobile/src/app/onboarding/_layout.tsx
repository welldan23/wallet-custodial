import { Stack } from 'expo-router';

/** Alur bikin/impor wallet: tanpa header bawaan, layar bergeser dari kanan. */
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
