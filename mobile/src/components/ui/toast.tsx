import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '@/hooks/use-theme';

export type ToastOptions = {
  title: string;
  message?: string;
  variant?: 'success' | 'error';
  /** Lama tampil (ms). */
  durationMs?: number;
};

type ToastState = ToastOptions & { id: number };

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

/** Notifikasi singkat di bawah layar. Toast baru menggantikan yang lama. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.durationMs ?? 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const show = (options: ToastOptions) => {
    nextId.current += 1;
    setToast({ ...options, id: nextId.current });
  };

  const isError = toast?.variant === 'error';

  return (
    <ToastContext value={show}>
      {children}
      {toast && (
        <View
          pointerEvents="none"
          className="absolute inset-x-0 items-center px-4"
          // Di atas semua layar (termasuk stack navigator).
          style={{ bottom: insets.bottom + 24, zIndex: 1000, elevation: 1000 }}>
          {/* className NativeWind tidak menempel ke Animated.View → gaya di View dalam. */}
          <Animated.View
            key={toast.id}
            entering={FadeInDown.duration(180)}
            exiting={FadeOutDown.duration(150)}
            style={{ width: '100%', maxWidth: 440 }}>
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="w-full flex-row items-start gap-2.5 rounded-2xl px-4 py-3"
              style={{
                backgroundColor: colors.ink.DEFAULT,
                boxShadow: '0px 8px 24px rgba(15, 23, 42, 0.25)',
              }}>
              <Ionicons
                name={isError ? 'alert-circle' : 'checkmark-circle'}
                size={20}
                color={isError ? colors.danger[500] : colors.success[500]}
              />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-white">{toast.title}</Text>
                {toast.message && (
                  <Text className="mt-0.5 text-xs leading-[18px] text-white/75">
                    {toast.message}
                  </Text>
                )}
              </View>
            </View>
          </Animated.View>
        </View>
      )}
    </ToastContext>
  );
}

export function useToast() {
  const show = use(ToastContext);
  if (!show) throw new Error('useToast harus dipakai di dalam <ToastProvider>');
  return show;
}
