import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useWallet } from '@/hooks/use-wallet';
import { useThemeColors } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

type IconName = ComponentProps<typeof Ionicons>['name'];

type TabIconProps = {
  focused: boolean;
  color: ColorValue;
  size: number;
  /** [ikon saat aktif, ikon saat tidak aktif] */
  icons: [IconName, IconName];
};

function TabIcon({ focused, color, size, icons: [active, inactive] }: TabIconProps) {
  return <Ionicons name={focused ? active : inactive} color={color} size={size - 2} />;
}

export default function TabsLayout() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const wallet = useWallet();

  // Pengguna baru (belum punya wallet) mulai dari onboarding, kecuali memilih demo.
  if (wallet.status === 'loading') return null;
  if (wallet.status === 'none' && !wallet.demoMode) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[500],
        tabBarInactiveTintColor: colors.ink.faint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.home,
          tabBarIcon: (props) => <TabIcon {...props} icons={['home', 'home-outline']} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t.tabs.history,
          tabBarIcon: (props) => <TabIcon {...props} icons={['pie-chart', 'pie-chart-outline']} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: t.tabs.portfolio,
          tabBarIcon: (props) => <TabIcon {...props} icons={['wallet', 'wallet-outline']} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          tabBarIcon: (props) => <TabIcon {...props} icons={['settings', 'settings-outline']} />,
        }}
      />
    </Tabs>
  );
}
