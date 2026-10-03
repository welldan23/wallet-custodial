import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

/** Lama "memindai" sebelum dianggap berhasil. */
export const SIMULATED_SCAN_MS = 1100;
/** Setelah sekian kali gagal, sarankan pakai PIN HP (seperti sensor asli). */
export const SIMULATED_MAX_FAILURES = 3;

type Phase = 'idle' | 'scanning' | 'success' | 'failed';

type SimulatedBiometricProps = {
  onSuccess: () => void;
};

/**
 * Sensor sidik jari TIRUAN untuk tempat tanpa sensor (preview web/mode demo):
 * ketuk → animasi memindai → centang → terbuka. Bisa juga mensimulasikan
 * gagal untuk melihat pesan error. Di HP sungguhan selalu memakai sensor asli.
 */
export function SimulatedBiometric({ onSuccess }: SimulatedBiometricProps) {
  const colors = useThemeColors();
  const { t } = useI18n();
  const copy = t.lock.simulated;
  const [phase, setPhase] = useState<Phase>('idle');
  const [failures, setFailures] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulse = useSharedValue(0);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.45 }],
  }));

  const scan = () => {
    if (phase === 'scanning' || phase === 'success') return;
    setPhase('scanning');
    pulse.value = 0;
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, false);
    timer.current = setTimeout(() => {
      cancelAnimation(pulse);
      pulse.value = 0;
      setPhase('success');
      setFailures(0);
      timer.current = setTimeout(onSuccess, 450);
    }, SIMULATED_SCAN_MS);
  };

  const fail = () => {
    if (timer.current) clearTimeout(timer.current);
    cancelAnimation(pulse);
    pulse.value = 0;
    setPhase('failed');
    setFailures((count) => count + 1);
  };

  const lockedOut = failures >= SIMULATED_MAX_FAILURES;
  const status =
    phase === 'scanning'
      ? copy.scanning
      : phase === 'success'
        ? copy.success
        : phase === 'failed'
          ? lockedOut
            ? t.lock.errors.lockout
            : copy.failed(SIMULATED_MAX_FAILURES - failures)
          : copy.idle;
  const tint =
    phase === 'success'
      ? colors.success[500]
      : phase === 'failed'
        ? colors.danger[500]
        : colors.primary[500];

  return (
    <View className="items-center gap-4 rounded-[28px] bg-surface/95 px-5 pb-4 pt-6">
      <Pressable
        onPress={scan}
        disabled={lockedOut}
        accessibilityRole="button"
        accessibilityLabel={copy.sensorLabel}
        accessibilityState={{ busy: phase === 'scanning', disabled: lockedOut }}
        className="h-24 w-24 items-center justify-center">
        <Animated.View
          pointerEvents="none"
          className="absolute h-24 w-24 rounded-full"
          style={[{ backgroundColor: tint }, ringStyle]}
        />
        <View
          className="h-24 w-24 items-center justify-center rounded-full border-2 bg-surface"
          style={{ borderColor: tint }}>
          <Ionicons
            name={phase === 'success' ? 'checkmark' : phase === 'failed' ? 'close' : 'finger-print'}
            size={phase === 'success' || phase === 'failed' ? 44 : 52}
            color={tint}
          />
        </View>
      </Pressable>

      <Text
        className="text-center text-[15px] font-semibold"
        style={{ color: phase === 'idle' ? colors.ink.DEFAULT : tint }}
        accessibilityLiveRegion="polite">
        {status}
      </Text>
      <Text className="text-center text-xs leading-[18px] text-ink-muted">{copy.note}</Text>

      {phase !== 'success' && !lockedOut && (
        <Pressable
          onPress={fail}
          disabled={phase === 'scanning'}
          accessibilityRole="button"
          hitSlop={8}
          className="active:opacity-60">
          <Text className="text-xs font-semibold text-ink-muted underline">
            {copy.simulateFail}
          </Text>
        </Pressable>
      )}
      {lockedOut && (
        <Pressable
          onPress={() => {
            setFailures(0);
            setPhase('idle');
          }}
          accessibilityRole="button"
          className="active:opacity-60">
          <Text className="text-xs font-semibold text-primary-600 underline">{copy.reset}</Text>
        </Pressable>
      )}
    </View>
  );
}
