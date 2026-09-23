import { TextInput, type TextInputProps, View } from 'react-native';

import { useThemeMode } from '@/shared/theme/theme-provider';
import { palette } from '@/shared/theme/tokens';
import { Text } from './text';

type InputProps = TextInputProps & { label: string; error?: string };

export function Input({ label, error, ...props }: InputProps) {
  const colors = palette[useThemeMode()];
  return (
    <View className="gap-2">
      <Text className="font-medium">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        className={`min-h-12 rounded-xl border bg-surface px-4 text-foreground ${error ? 'border-error' : 'border-border'}`}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        {...props}
      />
      {error ? <Text tone="error">{error}</Text> : null}
    </View>
  );
}
