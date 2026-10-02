import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { OnboardingButton, OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { useToast } from '@/components/ui/toast';
import { useOnboardingDraft } from '@/hooks/use-onboarding-draft';
import { useWallet } from '@/hooks/use-wallet';
import { useI18n } from '@/i18n';
import { cardShadow, colors } from '@/theme/colors';

/**
 * Langkah terakhir: simpan frasa di penyimpanan aman HP (Keychain/Keystore)
 * lalu masuk ke Home. Frasa di memori onboarding dihapus setelah tersimpan.
 */
export default function SecureWalletScreen() {
  const { t } = useI18n();
  const toast = useToast();
  const draft = useOnboardingDraft();
  const wallet = useWallet();
  const [saving, setSaving] = useState(false);

  if (!draft.mnemonic) return <Redirect href="/onboarding" />;
  const words = draft.mnemonic;

  const save = async () => {
    setSaving(true);
    try {
      await wallet.saveWallet(words);
      draft.setMnemonic(null);
      router.dismissTo('/');
    } catch {
      setSaving(false);
      toast({
        variant: 'error',
        title: t.onboarding.saveFailedTitle,
        message: t.onboarding.saveFailedBody,
      });
    }
  };

  const points = [
    { icon: 'lock-closed' as const, text: t.onboarding.secureDevice },
    wallet.biometricBound
      ? { icon: 'finger-print' as const, text: t.onboarding.secureBiometric }
      : { icon: 'finger-print' as const, text: t.onboarding.secureAppGate },
    { icon: 'cloud-offline' as const, text: t.onboarding.secureNoBackup },
  ];

  return (
    <OnboardingScreen
      title={t.onboarding.secureTitle}
      subtitle={t.onboarding.secureSubtitle}
      step={{ current: 3, total: 3 }}
      footer={
        <OnboardingButton
          label={saving ? t.onboarding.saving : t.onboarding.saveAndStart}
          icon="shield-checkmark"
          disabled={saving}
          onPress={save}
        />
      }>
      <View className="gap-1 rounded-[20px] bg-surface px-4 py-2" style={cardShadow}>
        {points.map((point, index) => (
          <View
            key={point.text}
            className={`flex-row items-start gap-3 py-3 ${index < points.length - 1 ? 'border-b border-line' : ''}`}>
            <View className="h-9 w-9 items-center justify-center rounded-full bg-teal-300/25">
              <Ionicons name={point.icon} size={18} color={colors.teal[500]} />
            </View>
            <Text className="flex-1 text-[13px] leading-5 text-ink-soft">{point.text}</Text>
          </View>
        ))}
      </View>

      {!wallet.persistent && (
        <View
          className="flex-row items-start gap-2 rounded-2xl border border-warning-500/40 bg-warning-50 px-4 py-3"
          accessibilityRole="alert">
          <Ionicons name="warning" size={18} color={colors.warning[600]} />
          <Text className="flex-1 text-[13px] leading-5 text-warning-600">
            {t.onboarding.webNotSaved}
          </Text>
        </View>
      )}
    </OnboardingScreen>
  );
}
