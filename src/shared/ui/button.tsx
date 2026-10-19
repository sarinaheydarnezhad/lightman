import { useId } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { Text } from './text';

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'destructive';
  loading?: boolean;
  icon?: LucideIcon;
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
  style,
  accessibilityState,
  ...props
}: ButtonProps) {
  const colors = useThemeColors();
  const gradient = `button-${useId().replace(/:/g, '')}`;
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
      className={`min-h-button flex-row items-center justify-center gap-sm overflow-hidden rounded-md border py-sm ${Icon ? 'px-3xl' : 'px-lg'} ${disabled ? 'bg-surfaceElevated border-border' : appearance[variant]}`}
      style={(state) => [
        { opacity: state.pressed && !unavailable ? 0.88 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
      disabled={unavailable}
    >
      {variant === 'primary' && !disabled ? (
        <Svg
          pointerEvents="none"
          accessible={Platform.OS === 'web' ? undefined : false}
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
        >
          <Defs>
            <LinearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.primary} />
              <Stop offset="1" stopColor={colors.primaryPressed} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradient})`} />
        </Svg>
      ) : null}
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
      {Icon ? (
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', right: 16 }}
        >
          <Icon color={foreground} size={22} />
        </View>
      ) : null}
    </Pressable>
  );
}
