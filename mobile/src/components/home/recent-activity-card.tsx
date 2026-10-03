import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useThemeColors } from '@/hooks/use-theme';
import { cardShadow } from '@/theme/colors';

type RecentActivityCardProps = {
  confirmed: boolean;
  title: string;
  subtitle: string;
  onOpen: () => void;
  onDismiss: () => void;
};

/** Info aktivitas terakhir (kirim/swap) di Home: masih diproses atau sudah selesai. */
export function RecentActivityCard({
  confirmed,
  title,
  subtitle,
  onOpen,
  onDismiss,
}: RecentActivityCardProps) {
  const colors = useThemeColors();
  const { t } = useI18n();

  return (
    <View
      className="flex-row items-center rounded-[20px] bg-surface pr-2"
      style={cardShadow}
      accessibilityLiveRegion="polite">
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}. ${t.home.activityOpen}`}
        className="flex-1 flex-row items-center gap-3 py-3.5 pl-4 active:opacity-70">
        <View
          className={`h-10 w-10 items-center justify-center rounded-full ${
            confirmed ? 'bg-success-50' : 'bg-primary-50'
          }`}>
          {confirmed ? (
            <Ionicons name="checkmark" size={22} color={colors.success[500]} />
          ) : (
            <ActivityIndicator size="small" color={colors.primary[500]} />
          )}
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-xs text-ink-muted" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.ink.faint} />
      </Pressable>
      {confirmed && (
        <Pressable
          onPress={onDismiss}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t.home.activityDismiss}
          className="ml-1 h-9 w-9 items-center justify-center rounded-full active:bg-black/5">
          <Ionicons name="close" size={18} color={colors.ink.muted} />
        </Pressable>
      )}
    </View>
  );
}
