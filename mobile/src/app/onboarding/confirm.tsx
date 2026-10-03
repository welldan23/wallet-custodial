import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { NoScreenCapture } from '@/components/onboarding/no-screen-capture';
import { OnboardingButton, OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { useOnboardingDraft } from '@/hooks/use-onboarding-draft';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { MNEMONIC_WORDLIST } from '@/lib/mnemonic';
import { buildMnemonicQuiz } from '@/lib/mnemonic-quiz';
import { cardShadow } from '@/theme/colors';

/**
 * Langkah 2 bikin wallet: pastikan 12 kata benar-benar sudah dicatat
 * dengan menanyakan 3 posisi acak. Salah boleh dicoba lagi.
 */
export default function ConfirmMnemonicScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const { mnemonic } = useOnboardingDraft();
  const [quiz] = useState(() =>
    mnemonic ? buildMnemonicQuiz(mnemonic, Math.random, { fallbackWords: MNEMONIC_WORDLIST }) : [],
  );
  const [picked, setPicked] = useState<Record<number, string>>({});

  if (!mnemonic) return <Redirect href="/onboarding" />;

  const allCorrect = quiz.every((question) => picked[question.index] === question.answer);
  const anyWrong = quiz.some(
    (question) =>
      picked[question.index] !== undefined && picked[question.index] !== question.answer,
  );

  return (
    <OnboardingScreen
      title={t.onboarding.confirmTitle}
      subtitle={t.onboarding.confirmSubtitle}
      step={{ current: 2, total: 3 }}
      footer={
        <>
          <OnboardingButton
            label={t.onboarding.continue}
            disabled={!allCorrect}
            onPress={() => router.push('/onboarding/secure')}
          />
          <OnboardingButton
            label={t.onboarding.seeWordsAgain}
            variant="secondary"
            icon="eye-outline"
            onPress={() => router.back()}
          />
        </>
      }>
      <NoScreenCapture />

      {quiz.map((question) => {
        const choice = picked[question.index];
        const correct = choice === question.answer;
        return (
          <View
            key={question.index}
            className="gap-3 rounded-[20px] bg-surface px-4 py-4"
            style={cardShadow}
            accessibilityRole="radiogroup"
            accessibilityLabel={t.onboarding.whichWord(question.index + 1)}>
            <View className="flex-row items-center justify-between">
              <Text className="text-[15px] font-bold text-ink">
                {t.onboarding.whichWord(question.index + 1)}
              </Text>
              {choice !== undefined && (
                <Ionicons
                  name={correct ? 'checkmark-circle' : 'close-circle'}
                  size={22}
                  color={correct ? colors.success[500] : colors.danger[500]}
                />
              )}
            </View>
            <View className="flex-row gap-2">
              {question.options.map((option) => {
                const selected = choice === option;
                const tone = !selected
                  ? 'border-line bg-subtle'
                  : correct
                    ? 'border-success-500 bg-success-50'
                    : 'border-danger-500 bg-danger-50';
                return (
                  <Pressable
                    key={option}
                    onPress={() =>
                      setPicked((current) => ({ ...current, [question.index]: option }))
                    }
                    accessibilityRole="radio"
                    aria-checked={selected}
                    className={`flex-1 items-center rounded-xl border py-3 active:opacity-70 ${tone}`}>
                    <Text className="text-[15px] font-semibold text-ink">{option}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}

      {anyWrong && (
        <View className="flex-row items-start gap-2 px-1" accessibilityRole="alert">
          <Ionicons name="alert-circle" size={16} color={colors.danger[600]} />
          <Text className="flex-1 text-[13px] leading-5 text-danger-600">
            {t.onboarding.quizWrong}
          </Text>
        </View>
      )}
      {allCorrect && (
        <View className="flex-row items-start gap-2 px-1" accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={16} color={colors.success[600]} />
          <Text className="flex-1 text-[13px] leading-5 text-success-600">
            {t.onboarding.quizAllRight}
          </Text>
        </View>
      )}
    </OnboardingScreen>
  );
}
