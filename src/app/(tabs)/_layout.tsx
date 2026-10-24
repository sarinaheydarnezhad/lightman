import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart3, House, Settings2, SquareStack } from 'lucide-react-native';

import { useThemeColors } from '@/shared/theme/theme-provider';
import { useLocalization } from '@/shared/localization/localization-provider';
import { heights, spacing, typography } from '@/shared/theme/tokens';
import { fontFamilyForWeight } from '@/shared/theme/font';

export default function TabsLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useLocalization();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.secondaryText,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          elevation: 0,
          boxShadow: 'none',
          paddingTop: spacing.sm,
          height: heights.tab + spacing.xl + (Platform.OS === 'web' ? 0 : insets.bottom),
          paddingBottom: Platform.OS === 'web' ? spacing.sm : Math.max(insets.bottom, spacing.sm),
          direction: 'ltr',
        },
        tabBarLabelStyle: {
          fontSize: Number(typography.caption[0]),
          fontFamily: fontFamilyForWeight('medium'),
          lineHeight: 18,
          marginTop: 2,
        },
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
          tabBarIcon: ({ color, size, focused }) => (
            <House color={color} size={size} fill={focused ? color : 'none'} />
          ),
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: t('nav.decks'),
          tabBarAccessibilityLabel: t('nav.tab', { name: t('nav.decks') }),
          tabBarIcon: ({ color, size }) => <SquareStack color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: t('nav.study'),
          href: null,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: t('nav.analytics'),
          tabBarAccessibilityLabel: t('nav.tab', { name: t('nav.analytics') }),
          tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav.settings'),
          tabBarAccessibilityLabel: t('nav.tab', { name: t('nav.settings') }),
          tabBarIcon: ({ color, size }) => <Settings2 color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
