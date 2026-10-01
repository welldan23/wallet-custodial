import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { TabScreen } from '@/components/layout/tab-screen';
import type { TopNavKey } from '@/components/layout/top-nav-pills';
import { useI18n } from '@/i18n';
import { cardShadow, colors } from '@/theme/colors';

type ComingSoonProps = {
  title: string;
  /** Pil header yang aktif; `null` untuk tab tanpa menu pil. */
  active: TopNavKey | null;
};

/** Halaman sementara untuk tab yang fiturnya belum dibangun. */
export function ComingSoon({ title, active }: ComingSoonProps) {
  const { t } = useI18n();

  return (
    <TabScreen active={active} title={title}>
      <View className="items-center gap-3 rounded-[20px] bg-surface px-6 py-10" style={cardShadow}>
        <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-50">
          <Ionicons name="time-outline" size={28} color={colors.primary[500]} />
        </View>
        <Text className="text-base font-bold text-ink">{t.common.comingSoon}</Text>
        <Text className="text-center text-sm leading-5 text-ink-muted">
          {t.common.comingSoonDescription}
        </Text>
      </View>
    </TabScreen>
  );
}
