import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { interaction } from '@/shared/theme/tokens';
import { Text } from './text';

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive';
  loading?: boolean;
};

const appearance = {
  primary: 'bg-primary border-primary',
  secondary: 'bg-surface border-border',
  tertiary: 'bg-transparent border-transparent',
  destructive: 'bg-error border-error',
};

export function Button({
  label,
  variant = 'primary',
  disabled,
  loading = false,
  style,
  accessibilityState,
  ...props
}: ButtonProps) {
  const colors = useThemeColors();
  const unavailable = disabled || loading;
  const foreground =
    variant === 'primary'
      ? colors.primaryForeground
      : variant === 'destructive'
        ? colors.errorForeground
        : colors.primaryText;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ ...accessibilityState, disabled: unavailable, busy: loading }}
      className={`min-h-button flex-row items-center justify-center gap-sm rounded-md border px-lg ${appearance[variant]}`}
      style={({ pressed }) => [
        typeof style === 'function' ? style({ pressed }) : style,
        {
          opacity: unavailable
            ? interaction.disabledOpacity
            : pressed
              ? interaction.pressedOpacity
              : 1,
        },
      ]}
      disabled={unavailable}
    >
      {loading ? <ActivityIndicator size="small" color={foreground} /> : null}
      <Text
        variant="labelLarge"
        tone={
          variant === 'primary'
            ? 'primaryForeground'
            : variant === 'destructive'
              ? 'errorForeground'
              : 'primaryText'
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
