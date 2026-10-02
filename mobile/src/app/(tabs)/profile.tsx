import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { TabScreen } from '@/components/layout/tab-screen';
import { ComingSoonCard } from '@/components/ui/coming-soon-card';
import { useContacts } from '@/hooks/use-contacts';
import { useI18n } from '@/i18n';
import { cardShadow, colors } from '@/theme/colors';

export default function ProfileScreen() {
  const { t } = useI18n();
  const { contacts } = useContacts();
  return (
    <TabScreen active={null} title={t.tabs.profile}>
      <View className="rounded-[20px] bg-surface px-4" style={cardShadow}>
        <Pressable
          onPress={() => router.push('/contacts')}
          accessibilityRole="button"
          className="flex-row items-center gap-3 py-3.5 active:opacity-70">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-50">
            <Ionicons name="people" size={20} color={colors.primary[500]} />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-semibold text-ink">{t.contacts.title}</Text>
            <Text className="text-xs text-ink-muted">{t.contacts.count(contacts.length)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.ink.faint} />
        </Pressable>
      </View>
      <ComingSoonCard description={t.profile.moreSoon} />
    </TabScreen>
  );
}
