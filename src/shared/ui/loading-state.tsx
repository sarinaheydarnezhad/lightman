import { ActivityIndicator, View } from 'react-native';

import { useThemeColors } from '@/shared/theme/theme-provider';
import { Text } from './text';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View
      className="items-center justify-center gap-md py-3xl"
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <ActivityIndicator color={useThemeColors().primary} />
      <Text tone="secondary">{label}</Text>
    </View>
  );
}
