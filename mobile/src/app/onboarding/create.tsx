import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MnemonicGrid } from '@/components/onboarding/mnemonic-grid';
import { NoScreenCapture } from '@/components/onboarding/no-screen-capture';
import { OnboardingButton, OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { useOnboardingDraft } from '@/hooks/use-onboarding-draft';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

/**
 * Langkah 1 bikin wallet: tampilkan 12 kata pemulihan untuk dicatat.
 * Kata dibuat di HP (lihat layar sambutan) dan hanya disimpan di memori
 * sampai alur selesai. Sengaja tanpa tombol salin (clipboard bisa
 * dibaca app lain) dan screenshot diblokir.
 */
export default function CreateWalletScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const draft = useOnboardingDraft();
  const words = draft.mnemonic;
  const [revealed, setRevealed] = useState(false);
  const [written, setWritten] = useState(false);

  // Dibuka langsung (mis. dari link) tanpa lewat tombol: mulai dari awal.
  if (!words) return <Redirect href="/onboarding" />;

  return (
    <OnboardingScreen
      title={t.onboarding.createTitle}
      subtitle={t.onboarding.createSubtitle}
      step={{ current: 1, total: 3 }}
      footer={
        <OnboardingButton
          label={t.onboarding.continue}
          disabled={!written}
          onPress={() => router.push('/onboarding/confirm')}
        />
      }>
      <NoScreenCapture />

      <View
        className="flex-row items-start gap-2.5 rounded-2xl border border-danger-500/40 bg-danger-50 px-4 py-3.5"
        accessibilityRole="alert">
        <Ionicons name="warning" size={20} color={colors.danger[600]} />
        <Text className="flex-1 text-[13px] font-medium leading-5 text-danger-600">
          {t.onboarding.secretWarning}
        </Text>
      </View>

      <MnemonicGrid words={words} hidden={!revealed} />

      <Pressable
        onPress={() => setRevealed((value) => !value)}
        accessibilityRole="button"
        className="flex-row items-center justify-center gap-2 self-center rounded-full bg-primary-50 px-5 py-2.5 active:opacity-70">
        <Ionicons
          name={revealed ? 'eye-off-outline' : 'eye-outline'}
          size={18}
          color={colors.primary[500]}
        />
        <Text className="text-sm font-semibold text-primary-500">
          {revealed ? t.onboarding.hideWords : t.onboarding.showWords}
        </Text>
      </Pressable>

      <View className="gap-2 rounded-2xl bg-subtle px-4 py-3.5">
        {t.onboarding.writeTips.map((tip) => (
          <View key={tip} className="flex-row items-start gap-2">
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={colors.success[500]}
              style={{ marginTop: 2 }}
            />
            <Text className="flex-1 text-[13px] leading-5 text-ink-soft">{tip}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => revealed && setWritten((value) => !value)}
        disabled={!revealed}
        accessibilityRole="checkbox"
        aria-checked={written}
        aria-disabled={!revealed}
        className={`flex-row items-start gap-3 rounded-2xl border px-4 py-3.5 ${
          written ? 'border-primary-500 bg-primary-50' : 'border-line bg-surface'
        } ${revealed ? '' : 'opacity-50'}`}>
        <View
          className={`mt-0.5 h-5 w-5 items-center justify-center rounded-md border-2 ${
            written ? 'border-primary-500 bg-primary-500' : 'border-ink-faint'
          }`}>
          {written && <Ionicons name="checkmark" size={14} color={colors.white} />}
        </View>
        <Text className="flex-1 text-[13px] leading-5 text-ink">
          {revealed ? t.onboarding.writtenCheck : t.onboarding.revealFirst}
        </Text>
      </Pressable>
    </OnboardingScreen>
  );
}
