import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTranslation } from '@/i18n';
import { colors } from '@/theme';

export default function TabLayout() {
  const { t } = useTranslation();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent,
    tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: '#FFFEF9', borderTopColor: colors.line } }}>
    <Tabs.Screen name="index" options={{ title: t('listen'),
      tabBarIcon: ({ color, size }) => <Ionicons name="mic-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="history" options={{ title: t('history'),
      tabBarIcon: ({ color, size }) => <Ionicons name="albums-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="profile" options={{ title: t('profile'),
      tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }} />
  </Tabs>;
}
