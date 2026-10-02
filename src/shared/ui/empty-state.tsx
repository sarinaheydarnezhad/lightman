import { BookOpen, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { useThemeColors } from '@/shared/theme/theme-provider';
import { icons } from '@/shared/theme/tokens';
import { Text } from './text';

export function EmptyState({
  title,
  description,
  icon: Icon = BookOpen,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  const colors = useThemeColors();
  return (
    <View className="items-center gap-md py-2xl">
      <View className="h-iconButton w-iconButton items-center justify-center rounded-md bg-primarySoft">
        <Icon color={colors.primary} size={icons.medium} />
      </View>
      <View className="items-center gap-xs">
        <Text variant="headingSmall" align="center" accessibilityRole="header">
          {title}
        </Text>
        <Text tone="secondary" align="center">
          {description}
        </Text>
      </View>
    </View>
  );
}
