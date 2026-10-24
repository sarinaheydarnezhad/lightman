import { forwardRef, useState } from 'react';
import { FeedbackModal } from './feedback-modal';
import { TextInput, type TextInputProps, View } from 'react-native';

import { useThemeColors, useThemeMode } from '@/shared/theme/theme-provider';
import { fontFamilyForWeight } from '@/shared/theme/font';
import { interaction } from '@/shared/theme/tokens';
import { getTextDirection } from '@/shared/localization/localization';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Text } from './text';

type InputProps = TextInputProps & {
  label: string;
  error?: string;
  onDismissError?: () => void;
  helperText?: string;
  disabled?: boolean;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    onDismissError,
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
    textAlign,
    ...props
  }: InputProps,
  ref,
) {
  const colors = useThemeColors();
  const mode = useThemeMode();
  const { direction: fallbackDirection } = useLocalization();
  const content = props.value || props.defaultValue || props.placeholder || '';
  const direction = /[\p{Letter}\u200e\u200f]/u.test(content)
    ? getTextDirection(content)
    : fallbackDirection;
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
        textAlign={textAlign ?? (direction === 'rtl' ? 'right' : 'left')}
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
        style={[
          { fontFamily: fontFamilyForWeight('regular'), writingDirection: direction, textAlign: textAlign ?? (direction === 'rtl' ? 'right' : 'left') },
          style,
          unavailable && { opacity: interaction.disabledOpacity },
        ]}
        placeholderTextColor={colors.tertiaryText}
        selectionColor={colors.primary}
      />
      {error ? (
        <FeedbackModal message={error} onDismiss={onDismissError}>
          <Text variant="labelMedium">{label}</Text>
        </FeedbackModal>
      ) : helperText ? (
        <Text variant="bodySmall" tone="secondary">
          {helperText}
        </Text>
      ) : null}
    </View>
  );
});
