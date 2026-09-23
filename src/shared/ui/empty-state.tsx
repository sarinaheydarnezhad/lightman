import { View } from 'react-native';

import { Text } from './text';

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <View className="items-center gap-2 py-12">
      <Text className="text-center text-xl font-semibold">{title}</Text>
      <Text tone="secondary" className="text-center">
        {description}
      </Text>
    </View>
  );
}
