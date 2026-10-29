import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { Text } from './text';

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'destructive';
  loading?: boolean;
  icon?: LucideIcon;
  iconOnly?: boolean;
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
  icon: Icon,
  iconOnly = false,
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
      className={`min-h-button flex-row items-center justify-center gap-sm overflow-hidden rounded-md border py-sm ${iconOnly ? 'px-0' : Icon ? 'px-3xl' : 'px-lg'} ${disabled ? 'bg-surfaceElevated border-border' : appearance[variant]}`}
      style={(state) => [
        { opacity: state.pressed && !unavailable ? 0.88 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
      disabled={unavailable}
    >
      {loading ? <ActivityIndicator size="small" color={foreground} /> : null}
      {accessibilityState?.selected ? (
        <Text variant="labelLarge" style={{ color: foreground }} accessible={false}>
          {'\u2713'}
        </Text>
      ) : null}
      {!iconOnly ? (
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
      ) : null}
      {Icon && !(iconOnly && loading) ? (
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          style={iconOnly ? undefined : { position: 'absolute', right: 16 }}
        >
          <Icon color={foreground} size={22} />
        </View>
      ) : null}
    </Pressable>
  );
}
