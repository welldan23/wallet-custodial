import Ionicons from '@expo/vector-icons/Ionicons';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { OnboardingButton, OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { useOnboardingDraft } from '@/hooks/use-onboarding-draft';
import { useWallet } from '@/hooks/use-wallet';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { createMnemonic } from '@/lib/mnemonic';
import { cardShadow } from '@/theme/colors';

const POINTS: {
  icon: ComponentProps<typeof Ionicons>['name'];
  key: 'keys' | 'biometric' | 'networks';
}[] = [
  { icon: 'key', key: 'keys' },
  { icon: 'finger-print', key: 'biometric' },
  { icon: 'git-network-outline', key: 'networks' },
];

/** Layar sambutan: pilih bikin wallet baru atau impor dari 12 kata. */
export default function WelcomeScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const draft = useOnboardingDraft();
  const wallet = useWallet();

  /** Frasa baru setiap kali mulai bikin wallet (dari sumber acak kriptografis HP). */
  const startCreate = () => {
    draft.setMnemonic(createMnemonic(Crypto.getRandomBytes));
    router.push('/onboarding/create');
  };

  return (
    <OnboardingScreen
      title={t.onboarding.welcomeTitle}
      subtitle={t.onboarding.welcomeSubtitle}
      showBack={false}
      footer={
        <>
          <OnboardingButton
            label={t.onboarding.createWallet}
            icon="add-circle-outline"
            onPress={startCreate}
          />
          <OnboardingButton
            label={t.onboarding.importWallet}
            icon="download-outline"
            variant="secondary"
            onPress={() => router.push('/onboarding/import')}
          />
          {wallet.status === 'none' && (
            <Pressable
              onPress={() => {
                wallet.exploreDemo();
                router.replace('/');
              }}
              accessibilityRole="button"
              className="items-center py-1.5 active:opacity-70">
              <Text className="text-[13px] font-semibold text-ink-muted">
                {t.onboarding.exploreDemo}
              </Text>
            </Pressable>
          )}
        </>
      }>
      <View className="items-center py-2">
        <View
          className="h-24 w-24 items-center justify-center rounded-[28px] bg-primary-500"
          style={cardShadow}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Ionicons name="wallet" size={48} color={colors.white} />
        </View>
        <Text className="mt-3 text-xl font-bold text-ink">MyWallet</Text>
        <Text className="text-[13px] text-ink-muted">{t.onboarding.tagline}</Text>
      </View>

      <View className="gap-1 rounded-[20px] bg-surface px-4 py-2" style={cardShadow}>
        {POINTS.map((point, index) => (
          <View
            key={point.key}
            className={`flex-row items-start gap-3 py-3 ${index < POINTS.length - 1 ? 'border-b border-line' : ''}`}>
            <View className="h-10 w-10 items-center justify-center rounded-full bg-teal-300/25">
              <Ionicons name={point.icon} size={20} color={colors.teal[500]} />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-ink">
                {t.onboarding.points[point.key].title}
              </Text>
              <Text className="text-[13px] leading-5 text-ink-muted">
                {t.onboarding.points[point.key].body}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </OnboardingScreen>
  );
}
