import { View } from 'react-native';
import { Text } from './text';

export function ScreenHeader({ title, description }: { title: string; description?: string }) {
  return (
    <View className="gap-sm">
      <Text variant="headingLarge" accessibilityRole="header">
        {title}
      </Text>
      {description ? <Text tone="secondary">{description}</Text> : null}
    </View>
  );
}
