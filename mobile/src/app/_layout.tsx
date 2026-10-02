import '@/global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppLockGate } from '@/components/lock/app-lock-gate';
import { ToastProvider } from '@/components/ui/toast';
import { BalanceVisibilityProvider } from '@/hooks/use-balance-visibility';
import { SentTransfersProvider } from '@/hooks/use-sent-transfers';
import { SwapsProvider } from '@/hooks/use-swaps';
import { WalletProvider } from '@/hooks/use-wallet';
import { I18nProvider } from '@/i18n';

export default function RootLayout() {
  return (
    <I18nProvider>
      <WalletProvider>
        <BalanceVisibilityProvider>
          <SentTransfersProvider>
            <SwapsProvider>
              <ToastProvider>
                <StatusBar style="dark" />
                <Stack screenOptions={{ headerShown: false }} />
                <AppLockGate />
              </ToastProvider>
            </SwapsProvider>
          </SentTransfersProvider>
        </BalanceVisibilityProvider>
      </WalletProvider>
    </I18nProvider>
  );
}
