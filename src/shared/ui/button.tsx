import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { Text } from './text';

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'destructive';
  loading?: boolean;
};

const appearance = {
  primary: 'bg-primary border-primary active:bg-primaryPressed',
  secondary: 'bg-surface border-border active:bg-surfaceElevated',
  tertiary: 'bg-transparent border-transparent active:bg-surfaceElevated',
  ghost: 'bg-transparent border-transparent active:bg-surfaceElevated',
  destructive: 'bg-error border-error active:bg-errorPressed',
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
  const foreground = disabled
    ? colors.disabled
    : variant === 'primary'
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
      className={`min-h-button flex-row items-center justify-center gap-sm rounded-md border px-lg ${disabled ? 'bg-surfaceElevated border-border' : appearance[variant]}`}
      style={(state) => (typeof style === 'function' ? style(state) : style)}
      disabled={unavailable}
    >
      {loading ? <ActivityIndicator size="small" color={foreground} /> : null}
      {accessibilityState?.selected ? (
        <Text variant="labelLarge" style={{ color: foreground }} accessible={false}>
          {'\u2713'}
        </Text>
      ) : null}
      <Text
        variant="labelLarge"
        className="flex-shrink"
        align="center"
        tone={
          disabled
            ? 'disabled'
            : variant === 'primary'
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
