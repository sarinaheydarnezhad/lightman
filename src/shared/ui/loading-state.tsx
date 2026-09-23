import { ActivityIndicator, View } from 'react-native';

import { useThemeMode } from '@/shared/theme/theme-provider';
import { palette } from '@/shared/theme/tokens';
import { Text } from './text';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View
      className="flex-1 items-center justify-center gap-3 bg-background"
      accessibilityRole="progressbar"
    >
      <ActivityIndicator color={palette[useThemeMode()].accent} />
      <Text tone="secondary">{label}</Text>
    </View>
  );
}
