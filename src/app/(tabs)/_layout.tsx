import { Tabs } from 'expo-router';
import { BarChart3, BookOpen, House, Settings2, SquareStack } from 'lucide-react-native';

import { useThemeColors } from '@/shared/theme/theme-provider';
import { useLocalization } from '@/shared/localization/localization-provider';
import { typography } from '@/shared/theme/tokens';

export default function TabsLayout() {
  const colors = useThemeColors();
  const { t } = useLocalization();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.secondaryText,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: Number(typography.caption[0]) },
        tabBarHideOnKeyboard: true,
        lazy: true,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarAccessibilityLabel: t('nav.tab', { name: t('nav.home') }),
          tabBarIcon: ({ color, size }) => <House color={color} size={size} accessible={false} />,
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: t('nav.decks'),
          tabBarAccessibilityLabel: t('nav.tab', { name: t('nav.decks') }),
          tabBarIcon: ({ color, size }) => (
            <SquareStack color={color} size={size} accessible={false} />
          ),
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: t('nav.study'),
          tabBarAccessibilityLabel: t('nav.tab', { name: t('nav.study') }),
          tabBarIcon: ({ color, size }) => (
            <BookOpen color={color} size={size} accessible={false} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: t('nav.analytics'),
          tabBarAccessibilityLabel: t('nav.tab', { name: t('nav.analytics') }),
          tabBarIcon: ({ color, size }) => (
            <BarChart3 color={color} size={size} accessible={false} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav.settings'),
          tabBarAccessibilityLabel: t('nav.tab', { name: t('nav.settings') }),
          tabBarIcon: ({ color, size }) => (
            <Settings2 color={color} size={size} accessible={false} />
          ),
        }}
      />
    </Tabs>
  );
}
