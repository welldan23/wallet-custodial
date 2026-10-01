import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { screenGradient } from '@/theme/colors';

/** Latar mint di bagian atas layar yang memudar ke warna kanvas. */
export function ScreenBackground({ height = 380 }: { height?: number }) {
  return (
    <LinearGradient
      colors={screenGradient}
      locations={[0, 0.55, 1]}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { height }]}
    />
  );
}
