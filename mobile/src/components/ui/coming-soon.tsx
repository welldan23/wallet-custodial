import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/i18n';
import { cardShadow, colors } from '@/theme/colors';

import { ScreenBackground } from './screen-background';

/** Halaman sementara untuk tab yang fiturnya belum dibangun. */
export function ComingSoon({ title }: { title: string }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-canvas">
      <ScreenBackground />
      <View className="flex-1 px-5" style={{ paddingTop: insets.top + 16 }}>
        <Text className="text-[28px] font-bold text-ink">{title}</Text>
        <View className="flex-1 items-center justify-center gap-3 px-6 pb-24">
          <View
            className="h-16 w-16 items-center justify-center rounded-full bg-surface"
            style={cardShadow}>
            <Ionicons name="time-outline" size={28} color={colors.brand[600]} />
          </View>
          <Text className="text-base font-bold text-ink">{t.common.comingSoon}</Text>
          <Text className="text-center text-sm leading-5 text-ink-muted">
            {t.common.comingSoonDescription}
          </Text>
        </View>
      </View>
    </View>
  );
}
