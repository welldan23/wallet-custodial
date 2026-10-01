import '@/global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { BalanceVisibilityProvider } from '@/hooks/use-balance-visibility';
import { I18nProvider } from '@/i18n';

export default function RootLayout() {
  return (
    <I18nProvider>
      <BalanceVisibilityProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </BalanceVisibilityProvider>
    </I18nProvider>
  );
}
