import { forwardRef, useState } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

import { useThemeColors, useThemeMode } from '@/shared/theme/theme-provider';
import { interaction } from '@/shared/theme/tokens';
import { Text } from './text';

type InputProps = TextInputProps & {
  label: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    disabled,
    editable = true,
    multiline,
    onFocus,
    onBlur,
    className,
    style,
    accessibilityLabel,
    accessibilityHint,
    keyboardAppearance,
    ...props
  }: InputProps,
  ref,
) {
  const colors = useThemeColors();
  const mode = useThemeMode();
  const [focused, setFocused] = useState(false);
  const unavailable = disabled || !editable;
  return (
    <View className="gap-sm">
      <Text variant="labelMedium">{label}</Text>
      <TextInput
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={
          error
            ? `Error: ${error}${accessibilityHint ? ` ${accessibilityHint}` : ''}`
            : (accessibilityHint ?? helperText)
        }
        accessibilityState={{ disabled: unavailable }}
        allowFontScaling
        keyboardAppearance={keyboardAppearance ?? (mode === 'light' ? 'light' : 'dark')}
        editable={!unavailable}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        className={`min-h-input rounded-md border bg-surface px-lg py-md text-bodyMedium text-primaryText ${error ? 'border-error' : focused ? 'border-primary' : 'border-border'} ${className ?? ''}`}
        style={[style, unavailable && { opacity: interaction.disabledOpacity }]}
        placeholderTextColor={colors.tertiaryText}
        selectionColor={colors.primary}
      />
      {error ? (
        <Text variant="bodySmall" tone="error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helperText ? (
        <Text variant="bodySmall" tone="secondary">
          {helperText}
        </Text>
      ) : null}
    </View>
  );
});
