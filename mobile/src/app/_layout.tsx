import '@/global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { I18nProvider } from '@/i18n';

export default function RootLayout() {
  return (
    <I18nProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </I18nProvider>
  );
}
