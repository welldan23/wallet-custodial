import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWallet } from '@/hooks/use-wallet';
import { useI18n } from '@/i18n';
import { shortenAddress } from '@/lib/address';
import { authorizeSigning, type SigningAuthResult } from '@/lib/biometric';
import { useThemeColors } from '@/hooks/use-theme';
import { themeGradients } from '@/theme/colors';

/**
 * Layar kunci di atas seluruh app: buka pakai sidik jari / Face ID (PIN HP
 * sebagai cadangan). Langsung meminta verifikasi saat tampil; saldo dan
 * navigasi di bawahnya tidak terlihat sampai terbuka.
 */
export function UnlockScreen() {
  const colors = useThemeColors();
  const gradients = themeGradients(colors);
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SigningAuthResult | null>(null);

  const tryUnlock = async () => {
    setBusy(true);
    const outcome = await authorizeSigning(t.lock.prompt, t.common.cancel, {
      requireConfirmation: false,
    });
    setBusy(false);
    setResult(outcome);
    if (outcome === 'success') wallet.unlock();
  };

  // Android: tombol back tidak boleh membuka/menggeser layar di bawah kunci.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  // Minta verifikasi otomatis sekali saat layar kunci muncul (kecuali di web).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const outcome = await authorizeSigning(t.lock.prompt, t.common.cancel, {
        requireConfirmation: false,
      });
      if (cancelled) return;
      setResult(outcome);
      if (outcome === 'success') wallet.unlock();
    };
    run();
    return () => {
      cancelled = true;
    };
    // Sekali saja saat tampil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const message =
    result && result !== 'success' && result !== 'unsupported' ? t.lock.errors[result] : null;
  const isPreview = result === 'unsupported';

  return (
    <View
      style={StyleSheet.absoluteFill}
      className="z-50 bg-teal-300"
      accessibilityViewIsModal
      importantForAccessibility="yes">
      <LinearGradient
        colors={gradients.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        className="flex-1 items-center justify-between px-6"
        style={{ paddingTop: insets.top + 80, paddingBottom: insets.bottom + 32 }}>
        <View className="items-center">
          <View className="h-24 w-24 items-center justify-center rounded-[28px] bg-white/25">
            <Ionicons name="lock-closed" size={44} color={colors.white} />
          </View>
          <Text className="mt-6 text-[26px] font-bold text-white" accessibilityRole="header">
            {t.lock.title}
          </Text>
          <Text className="mt-2 text-center text-[15px] leading-[22px] text-white/90">
            {t.lock.subtitle}
          </Text>
          {wallet.accounts && (
            <View className="mt-4 rounded-full bg-white/20 px-3 py-1.5">
              <Text className="text-xs font-semibold text-white">
                {shortenAddress(wallet.accounts.evm)}
              </Text>
            </View>
          )}
        </View>

        <View className="w-full max-w-[420px] gap-3">
          {message && (
            <View
              className="flex-row items-start gap-2 rounded-2xl bg-white/95 px-4 py-3"
              accessibilityRole="alert">
              <Ionicons name="alert-circle" size={18} color={colors.danger[600]} />
              <Text className="flex-1 text-[13px] leading-5 text-ink-soft">{message}</Text>
            </View>
          )}
          {isPreview && (
            <View className="flex-row items-start gap-2 rounded-2xl bg-white/95 px-4 py-3">
              <Ionicons name="information-circle" size={18} color={colors.warning[600]} />
              <Text className="flex-1 text-[13px] leading-5 text-ink-soft">
                {t.lock.previewNote}
              </Text>
            </View>
          )}
          <Pressable
            onPress={isPreview ? wallet.unlock : tryUnlock}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ busy }}
            className="flex-row items-center justify-center gap-2 rounded-full bg-white py-4 active:opacity-80">
            {busy ? (
              <ActivityIndicator color={colors.primary[500]} />
            ) : (
              <Ionicons name="finger-print" size={22} color={colors.primary[500]} />
            )}
            <Text className="text-base font-semibold text-primary-500">
              {isPreview ? t.lock.previewUnlock : t.lock.unlock}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
