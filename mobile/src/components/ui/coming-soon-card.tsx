import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { cardShadow, colors } from '@/theme/colors';

/** Kartu "Segera hadir" untuk halaman yang fiturnya belum dibangun. */
export function ComingSoonCard({ description }: { description?: string }) {
  const { t } = useI18n();

  return (
    <View className="items-center gap-3 rounded-[20px] bg-surface px-6 py-10" style={cardShadow}>
      <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-50">
        <Ionicons name="time-outline" size={28} color={colors.primary[500]} />
      </View>
      <Text className="text-base font-bold text-ink">{t.common.comingSoon}</Text>
      <Text className="text-center text-sm leading-5 text-ink-muted">
        {description ?? t.common.comingSoonDescription}
      </Text>
    </View>
  );
}
