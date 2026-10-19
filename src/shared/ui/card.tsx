import { type PropsWithChildren } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import { useSurfaceStyle } from '@/shared/theme/use-surface-style';
import { interaction } from '@/shared/theme/tokens';

type CardProps = PropsWithChildren<
  PressableProps & { variant?: 'default' | 'elevated' | 'outlined' | 'interactive' }
>;

const appearance = {
  default: 'border-surface bg-surface',
  elevated: 'border-border bg-surface',
  outlined: 'border-border bg-background',
  interactive: 'border-surface bg-surface',
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
  const elevation = useSurfaceStyle();
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
          elevation,
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
      style={[
        variant === 'outlined' ? undefined : elevation,
        typeof style === 'function' ? undefined : style,
      ]}
    >
      {children}
    </View>
  );
}
