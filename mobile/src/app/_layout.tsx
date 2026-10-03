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
import { WalletProvider } from '@/hooks/use-wallet';
import { I18nProvider } from '@/i18n';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <I18nProvider>
        <WalletProvider>
          <BalanceVisibilityProvider>
            <SentTransfersProvider>
              <SwapsProvider>
                <ContactsProvider>
                  <ToastProvider>
                    <StatusBar style="dark" />
                    <Stack screenOptions={{ headerShown: false }} />
                    <AppLockGate />
                  </ToastProvider>
                </ContactsProvider>
              </SwapsProvider>
            </SentTransfersProvider>
          </BalanceVisibilityProvider>
        </WalletProvider>
      </I18nProvider>
    </SettingsProvider>
  );
}
