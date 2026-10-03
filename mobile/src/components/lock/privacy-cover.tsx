import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/hooks/use-theme';

/**
 * Tutupi app saat tidak aktif (pindah app / app switcher), supaya saldo &
 * alamat tidak terlihat di pratinjau. Android juga dibantu FLAG_SECURE di
 * layar frasa; ini berlaku untuk semua layar.
 */
export function PrivacyCover() {
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) =>
      setVisible(state !== 'active'),
    );
    return () => subscription.remove();
  }, []);

  if (!visible) return null;
  return (
    <View
      style={StyleSheet.absoluteFill}
      className="z-50 items-center justify-center bg-teal-400"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Ionicons name="wallet" size={56} color={colors.white} />
    </View>
  );
}
