import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { NoScreenCapture } from '@/components/onboarding/no-screen-capture';
import { OnboardingButton, OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { NetworkIcon } from '@/components/crypto/network-icon';
import { useOnboardingDraft } from '@/hooks/use-onboarding-draft';
import { useI18n } from '@/i18n';
import { groupAddress } from '@/lib/address';
import { deriveAddresses } from '@/lib/keys';
import { isValidMnemonic } from '@/lib/mnemonic';
import {
  fillWords,
  MNEMONIC_LENGTH,
  splitMnemonicText,
  suggestWords,
  wordStatus,
} from '@/lib/mnemonic-input';
import { cardShadow, colors } from '@/theme/colors';
import type { WalletAccounts } from '@/types/wallet';

const EMPTY = Array<string>(MNEMONIC_LENGTH).fill('');
const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * Impor wallet dari 12 kata: isi per kolom (dengan saran kata) atau tempel
 * sekaligus, cek daftar kata + checksum, lalu tampilkan alamat EVM & Solana
 * hasil turunan untuk dikonfirmasi sebelum dipakai.
 */
export default function ImportWalletScreen() {
  const { t } = useI18n();
  const draft = useOnboardingDraft();
  const [words, setWords] = useState<string[]>(EMPTY);
  const [focused, setFocused] = useState<number | null>(0);
  const [checksumError, setChecksumError] = useState(false);
  const [deriving, setDeriving] = useState(false);
  const [accounts, setAccounts] = useState<WalletAccounts | null>(null);
  const inputs = useRef<(TextInput | null)[]>([]);

  const statuses = words.map(wordStatus);
  const invalid = statuses
    .map((status, index) => (status === 'invalid' ? index + 1 : null))
    .filter((value): value is number => value !== null);
  const complete = statuses.every((status) => status === 'valid');

  const update = (next: string[]) => {
    setWords(next);
    setChecksumError(false);
    setAccounts(null);
  };

  const onChange = (index: number, text: string) => {
    const parts = splitMnemonicText(text);
    // Tempel beberapa kata sekaligus → sebar ke kolom berikutnya.
    if (parts.length > 1) {
      update(fillWords(words, index, parts));
      const last = Math.min(index + parts.length, MNEMONIC_LENGTH) - 1;
      inputs.current[Math.min(last + 1, MNEMONIC_LENGTH - 1)]?.focus();
      return;
    }
    update(fillWords(words, index, [text.trim().toLowerCase()]));
  };

  const pick = (index: number, word: string) => {
    update(fillWords(words, index, [word]));
    if (index < MNEMONIC_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const pasteAll = async () => {
    const text = await Clipboard.getStringAsync().catch(() => '');
    const parts = splitMnemonicText(text);
    if (parts.length) update(fillWords(EMPTY, 0, parts));
  };

  const verify = () => {
    if (!isValidMnemonic(words)) {
      setChecksumError(true);
      return;
    }
    setDeriving(true);
    // Beri waktu spinner tampil: hitungan kunci butuh sesaat di HP.
    setTimeout(() => {
      try {
        setAccounts(deriveAddresses(words));
      } finally {
        setDeriving(false);
      }
    }, 30);
  };

  const useWallet = () => {
    draft.setMnemonic(words);
    router.push('/onboarding/secure');
  };

  const suggestions =
    focused !== null && statuses[focused] !== 'valid' ? suggestWords(words[focused] ?? '') : [];

  return (
    <OnboardingScreen
      title={t.onboarding.importTitle}
      subtitle={t.onboarding.importSubtitle}
      step={{ current: 1, total: 2 }}
      footer={
        accounts ? (
          <OnboardingButton
            label={t.onboarding.useThisWallet}
            icon="checkmark-circle"
            onPress={useWallet}
          />
        ) : (
          <OnboardingButton
            label={deriving ? t.onboarding.checking : t.onboarding.importAction}
            disabled={!complete || deriving}
            onPress={verify}
          />
        )
      }>
      <NoScreenCapture />

      <View className="flex-row gap-2">
        <Pressable
          onPress={pasteAll}
          accessibilityRole="button"
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary-50 py-2.5 active:opacity-70">
          <Ionicons name="clipboard-outline" size={16} color={colors.primary[500]} />
          <Text className="text-[13px] font-semibold text-primary-500">
            {t.onboarding.pasteAll}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            update(EMPTY);
            inputs.current[0]?.focus();
          }}
          accessibilityRole="button"
          className="flex-row items-center justify-center gap-1.5 rounded-full bg-surface px-4 py-2.5 active:opacity-70">
          <Ionicons name="trash-outline" size={16} color={colors.ink.muted} />
          <Text className="text-[13px] font-semibold text-ink-muted">{t.onboarding.clearAll}</Text>
        </Pressable>
      </View>

      <View className="flex-row flex-wrap rounded-[20px] bg-surface p-2" style={cardShadow}>
        {words.map((word, index) => {
          const status = statuses[index];
          const border =
            status === 'invalid'
              ? 'border-danger-500 bg-danger-50'
              : focused === index
                ? 'border-primary-500 bg-surface'
                : 'border-transparent bg-subtle';
          return (
            <View key={index} className="w-1/2 p-1.5">
              <View className={`flex-row items-center gap-2 rounded-xl border px-3 ${border}`}>
                <Text className="w-5 text-right text-xs font-semibold text-ink-faint">
                  {index + 1}
                </Text>
                <TextInput
                  ref={(node) => {
                    inputs.current[index] = node;
                  }}
                  value={word}
                  onChangeText={(text) => onChange(index, text)}
                  onFocus={() => setFocused(index)}
                  onSubmitEditing={() => inputs.current[index + 1]?.focus()}
                  returnKeyType={index === MNEMONIC_LENGTH - 1 ? 'done' : 'next'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  spellCheck={false}
                  importantForAutofill="no"
                  // Android: keyboard tanpa saran/belajar kata.
                  keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
                  accessibilityLabel={t.onboarding.wordInputLabel(index + 1)}
                  className="min-h-[44px] flex-1 text-[15px] font-semibold text-ink"
                  // minWidth 0: di web kotak isian punya lebar minimum bawaan yang bikin kolom melebar.
                  style={[
                    { fontFamily: monoFont, minWidth: 0 },
                    { outlineStyle: 'none' } as object,
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {suggestions.length > 0 && focused !== null && (
        <View
          className="flex-row flex-wrap gap-2"
          accessibilityLabel={t.onboarding.suggestionsLabel}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => pick(focused, suggestion)}
              accessibilityRole="button"
              className="rounded-full border border-primary-500/30 bg-primary-50 px-3.5 py-2 active:opacity-70">
              <Text className="text-[13px] font-semibold text-primary-500">{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {invalid.length > 0 && (
        <Text className="px-1 text-[13px] leading-5 text-danger-600" accessibilityRole="alert">
          {t.onboarding.unknownWords(invalid.join(', '))}
        </Text>
      )}
      {checksumError && (
        <View
          className="flex-row items-start gap-2 rounded-2xl border border-danger-500/40 bg-danger-50 px-4 py-3"
          accessibilityRole="alert">
          <Ionicons name="close-circle" size={18} color={colors.danger[600]} />
          <Text className="flex-1 text-[13px] leading-5 text-danger-600">
            {t.onboarding.checksumError}
          </Text>
        </View>
      )}
      {deriving && (
        <View className="flex-row items-center justify-center gap-2 py-2">
          <ActivityIndicator color={colors.primary[500]} />
          <Text className="text-[13px] text-ink-muted">{t.onboarding.deriving}</Text>
        </View>
      )}

      {accounts && (
        <View
          className="gap-3 rounded-[20px] bg-surface px-4 py-4"
          style={cardShadow}
          accessibilityLiveRegion="polite">
          <View className="flex-row items-center gap-2">
            <Ionicons name="checkmark-circle" size={20} color={colors.success[500]} />
            <Text className="flex-1 text-[15px] font-bold text-ink">
              {t.onboarding.foundWallet}
            </Text>
          </View>
          <Text className="text-[13px] leading-5 text-ink-muted">
            {t.onboarding.foundWalletHint}
          </Text>
          {(
            [
              ['ethereum', t.onboarding.evmAddress, accounts.evm],
              ['solana', t.onboarding.solanaAddress, accounts.solana],
            ] as const
          ).map(([networkId, label, address]) => (
            <View key={networkId} className="gap-1 rounded-xl bg-subtle px-3 py-2.5">
              <View className="flex-row items-center gap-1.5">
                <NetworkIcon networkId={networkId} size={14} />
                <Text className="text-xs font-semibold text-ink-soft">{label}</Text>
              </View>
              <Text
                selectable
                className="text-[13px] leading-5 text-ink"
                style={{ fontFamily: monoFont }}>
                {groupAddress(address).join(' ')}
              </Text>
            </View>
          ))}
        </View>
      )}
    </OnboardingScreen>
  );
}
