import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, Text, View } from 'react-native';

import { SimulatedBiometric } from '@/components/lock/simulated-biometric';
import { StackScreen } from '@/components/layout/stack-screen';
import { MnemonicGrid } from '@/components/onboarding/mnemonic-grid';
import { NoScreenCapture } from '@/components/onboarding/no-screen-capture';
import { useThemeColors } from '@/hooks/use-theme';
import { useWallet } from '@/hooks/use-wallet';
import { useI18n } from '@/i18n';
import { authorizeSigning } from '@/lib/biometric';
import { cardShadow } from '@/theme/colors';

/** Frasa disembunyikan lagi setelah tampil selama ini. */
const REVEAL_TIMEOUT_MS = 60_000;

type RevealError = 'cancelled' | 'missing' | 'no_lock' | 'lockout' | 'failed';
type Phase = 'intro' | 'verifying' | 'simulate' | 'revealed' | RevealError;

/**
 * Lihat 12 kata: centang peringatan → verifikasi sidik jari/Face ID → tampil
 * (tanpa screenshot). Disembunyikan lagi saat app ditinggal, setelah 1 menit,
 * atau saat keluar dari halaman. Tidak ada tombol salin.
 */
export default function RecoveryPhraseScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const copy = t.revealPhrase;
  const wallet = useWallet();
  const [acks, setAcks] = useState([false, false, false]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [words, setWords] = useState<string[] | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setWords(null);
    setPhase('intro');
  };

  // Ditinggal ke app lain → langsung disembunyikan; keluar halaman → dihapus dari memori.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') hide();
    });
    return () => {
      subscription.remove();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const read = async () => {
    setPhase('verifying');
    const result = await wallet.readMnemonic();
    if (result.status !== 'ok') {
      setPhase(result.status);
      return;
    }
    setWords(result.words);
    setPhase('revealed');
    hideTimer.current = setTimeout(hide, REVEAL_TIMEOUT_MS);
  };

  const reveal = async () => {
    // Kalau frasa terkunci biometrik, penyimpanan aman sendiri yang meminta sidik jari.
    if (wallet.biometricBound) return read();
    setPhase('verifying');
    const auth = await authorizeSigning(copy.prompt, t.common.cancel, {
      requireConfirmation: false,
    });
    if (auth === 'unsupported') return setPhase('simulate');
    if (auth !== 'success') return setPhase(auth);
    return read();
  };

  if (wallet.status !== 'ready') {
    return (
      <StackScreen title={copy.title}>
        <View className="items-center gap-3 rounded-[20px] bg-surface px-6 py-8" style={cardShadow}>
          <Ionicons name="key-outline" size={30} color={colors.ink.faint} />
          <Text className="text-center text-base font-bold text-ink">{copy.noWalletTitle}</Text>
          <Text className="text-center text-sm leading-5 text-ink-muted">{copy.noWalletBody}</Text>
          <Pressable
            onPress={() => router.push('/onboarding')}
            accessibilityRole="button"
            className="mt-1 rounded-full bg-primary-500 px-5 py-3 active:opacity-80">
            <Text className="text-sm font-semibold text-white">{copy.setUpWallet}</Text>
          </Pressable>
        </View>
      </StackScreen>
    );
  }

  const allAcked = acks.every(Boolean);
  const error: RevealError | null =
    phase === 'cancelled' ||
    phase === 'missing' ||
    phase === 'no_lock' ||
    phase === 'lockout' ||
    phase === 'failed'
      ? phase
      : null;

  if (phase === 'revealed' && words) {
    return (
      <StackScreen title={copy.title}>
        <NoScreenCapture />
        <View className="flex-row items-start gap-2 rounded-2xl bg-danger-50 px-4 py-3">
          <Ionicons name="eye-off" size={18} color={colors.danger[600]} />
          <Text className="flex-1 text-[13px] leading-5 text-danger-600">
            {copy.revealedWarning}
          </Text>
        </View>
        <MnemonicGrid words={words} hidden={false} />
        <Text className="text-center text-xs text-ink-muted">{copy.autoHide}</Text>
        <Pressable
          onPress={hide}
          accessibilityRole="button"
          className="flex-row items-center justify-center gap-2 rounded-full bg-primary-500 py-4 active:opacity-80">
          <Ionicons name="eye-off-outline" size={18} color={colors.white} />
          <Text className="text-base font-semibold text-white">{copy.hideNow}</Text>
        </Pressable>
      </StackScreen>
    );
  }

  return (
    <StackScreen title={copy.title}>
      <View className="items-center gap-2 px-2 pt-2">
        <View className="h-16 w-16 items-center justify-center rounded-[22px] bg-warning-50">
          <Ionicons name="key" size={30} color={colors.warning[600]} />
        </View>
        <Text className="text-center text-xl font-bold text-ink">{copy.headline}</Text>
        <Text className="text-center text-sm leading-5 text-ink-muted">{copy.intro}</Text>
      </View>

      <View className="gap-1 rounded-[20px] bg-surface px-4 py-2" style={cardShadow}>
        {copy.acks.map((label, index) => (
          <Pressable
            key={label}
            onPress={() => setAcks((current) => current.map((v, i) => (i === index ? !v : v)))}
            accessibilityRole="checkbox"
            aria-checked={acks[index]}
            className="flex-row items-start gap-3 py-2.5 active:opacity-70">
            <Ionicons
              name={acks[index] ? 'checkbox' : 'square-outline'}
              size={22}
              color={acks[index] ? colors.primary[500] : colors.ink.muted}
            />
            <Text className="flex-1 text-[14px] leading-5 text-ink">{label}</Text>
          </Pressable>
        ))}
      </View>

      {error && (
        <View
          className="flex-row items-start gap-2 rounded-2xl border border-danger-500/40 bg-danger-50 px-4 py-3"
          accessibilityRole="alert">
          <Ionicons name="alert-circle" size={18} color={colors.danger[600]} />
          <View className="flex-1 gap-2">
            <Text className="text-[13px] leading-5 text-ink-soft">{copy.errors[error]}</Text>
            {error === 'missing' && (
              <Pressable
                onPress={() => router.push('/onboarding/import')}
                accessibilityRole="button"
                className="self-start rounded-full bg-surface px-4 py-2 active:opacity-70">
                <Text className="text-[13px] font-semibold text-primary-500">{copy.reimport}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {phase === 'simulate' ? (
        <View className="rounded-[28px] bg-teal-500 p-3">
          <SimulatedBiometric onSuccess={read} />
        </View>
      ) : (
        <Pressable
          onPress={reveal}
          disabled={!allAcked || phase === 'verifying'}
          accessibilityRole="button"
          accessibilityState={{ disabled: !allAcked, busy: phase === 'verifying' }}
          className={`flex-row items-center justify-center gap-2 rounded-full py-4 ${
            allAcked ? 'bg-primary-500 active:opacity-80' : 'bg-line'
          }`}>
          {phase === 'verifying' ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Ionicons
              name="finger-print"
              size={20}
              color={allAcked ? colors.white : colors.ink.faint}
            />
          )}
          <Text className={`text-base font-semibold ${allAcked ? 'text-white' : 'text-ink-faint'}`}>
            {copy.reveal}
          </Text>
        </Pressable>
      )}

      <Pressable
        onPress={() => router.push('/security/phrase-protection')}
        accessibilityRole="button"
        className="items-center py-1 active:opacity-70">
        <Text className="text-[13px] font-semibold text-primary-500">{copy.learnMore}</Text>
      </Pressable>
    </StackScreen>
  );
}
