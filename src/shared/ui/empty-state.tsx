import { View } from 'react-native';

import { Text } from './text';

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View className="items-center gap-sm py-3xl">
      <Text variant="headingMedium" align="center" accessibilityRole="header">{title}</Text>
      <Text tone="secondary" align="center">
        {description}
      </Text>
    </View>
  );
}
