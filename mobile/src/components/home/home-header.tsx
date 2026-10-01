import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { colors } from '@/theme/colors';

/** Avatar + nama wallet di bagian paling atas Home. */
export function HomeHeader() {
  const { t } = useI18n();

  return (
    <View className="flex-row items-center gap-3">
      <View className="h-11 w-11 items-center justify-center rounded-full border-2 border-surface bg-brand-600">
        <Ionicons name="wallet" size={20} color={colors.surface} />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-bold text-ink">{t.home.walletName}</Text>
        <Text className="text-xs font-medium text-ink-muted">{t.home.walletSubtitle}</Text>
      </View>
    </View>
  );
}
