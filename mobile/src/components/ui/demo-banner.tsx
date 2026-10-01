import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';

import { colors } from '@/theme/colors';

/** Peringatan mencolok saat layar memakai data contoh yang tidak boleh dipakai beneran. */
export function DemoBanner({ message }: { message: string }) {
  return (
    <View
      className="flex-row items-start gap-2 rounded-2xl border border-warning-500/40 bg-warning-50 px-3.5 py-3"
      accessibilityRole="alert">
      <Ionicons name="warning" size={18} color={colors.warning[600]} />
      <Text className="flex-1 text-[13px] font-medium leading-5 text-warning-600">{message}</Text>
    </View>
  );
}
