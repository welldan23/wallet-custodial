import '@/global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppLockGate } from '@/components/lock/app-lock-gate';
import { ToastProvider } from '@/components/ui/toast';
import { BalanceVisibilityProvider } from '@/hooks/use-balance-visibility';
import { ContactsProvider } from '@/hooks/use-contacts';
import { SentTransfersProvider } from '@/hooks/use-sent-transfers';
import { SettingsProvider } from '@/hooks/use-settings';
import { SwapsProvider } from '@/hooks/use-swaps';
import { ThemeProvider, useTheme } from '@/hooks/use-theme';
import { WalletProvider } from '@/hooks/use-wallet';
import { I18nProvider } from '@/i18n';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <I18nProvider>
          <WalletProvider>
            <BalanceVisibilityProvider>
              <SentTransfersProvider>
                <SwapsProvider>
                  <ContactsProvider>
                    <ToastProvider>
                      <ThemedStack />
                      <AppLockGate />
                    </ToastProvider>
                  </ContactsProvider>
                </SwapsProvider>
              </SentTransfersProvider>
            </BalanceVisibilityProvider>
          </WalletProvider>
        </I18nProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}

/** Navigasi + status bar yang mengikuti tema (latar layar = kanvas tema). */
function ThemedStack() {
  const { scheme, colors } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}
      />
    </>
  );
}
