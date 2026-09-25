import { type PropsWithChildren } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { interaction, shadows } from '@/shared/theme/tokens';

type CardProps = PropsWithChildren<
  PressableProps & { variant?: 'default' | 'elevated' | 'outlined' | 'interactive' }
>;

const appearance = {
  default: 'border-border bg-surface',
  elevated: 'border-transparent bg-surfaceElevated',
  outlined: 'border-border bg-background',
  interactive: 'border-border bg-surface',
};

export function Card({
  children,
  variant = 'default',
  className,
  style,
  disabled,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  ...props
}: CardProps) {
  const colors = useThemeColors();
  const shadow = shadows.small;
  const elevation =
    variant === 'elevated'
      ? {
          shadowColor: colors.overlay,
          shadowOpacity: shadow.opacity,
          shadowRadius: shadow.radius,
          shadowOffset: { width: 0, height: shadow.offset },
          elevation: shadow.elevation,
        }
      : undefined;
  const classes = `rounded-lg border p-xl ${appearance[variant]} ${className ?? ''}`;

  if (variant === 'interactive') {
    return (
      <Pressable
        {...props}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
        className={classes}
        disabled={disabled}
        style={(state) => [
          typeof style === 'function' ? style(state) : style,
          {
            opacity: disabled
              ? interaction.disabledOpacity
              : state.pressed
                ? interaction.pressedOpacity
                : 1,
          },
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      {...props}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      className={classes}
      style={[typeof style === 'function' ? undefined : style, elevation]}
    >
      {children}
    </View>
  );
}
