import { Pressable, View, type PressableProps } from 'react-native';
import { Text } from './text';
import type { SemanticVariant } from './badge';
import { interaction } from '@/shared/theme/tokens';

type ChipProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: SemanticVariant;
  selected?: boolean;
};

const selectedAppearance = {
  neutral: 'border-primary bg-primary',
  primary: 'border-primary bg-primary',
  success: 'border-success bg-success',
  error: 'border-error bg-error',
  warning: 'border-warning bg-warning',
};
const selectedTone = {
  neutral: 'primaryForeground',
  primary: 'primaryForeground',
  success: 'successForeground',
  error: 'errorForeground',
  warning: 'warningForeground',
} as const;
const unselectedAppearance = {
  neutral: 'border-border bg-surface',
  primary: 'border-primary bg-surface',
  success: 'border-success bg-surface',
  error: 'border-error bg-surface',
  warning: 'border-warning bg-surface',
};
const unselectedTone = {
  neutral: 'primaryText',
  primary: 'accent',
  success: 'success',
  error: 'error',
  warning: 'warning',
} as const;

export function Chip({
  label,
  variant = 'neutral',
  selected = false,
  onPress,
  disabled,
  style,
  accessibilityState,
  ...props
}: ChipProps) {
  const classes = `min-h-iconButton self-start flex-row items-center rounded-full border px-lg ${selected ? selectedAppearance[variant] : unselectedAppearance[variant]}`;
  const content = (
    <Text variant="labelMedium" tone={selected ? selectedTone[variant] : unselectedTone[variant]}>
      {label}
    </Text>
  );

  if (!onPress) return <View className={classes}>{content}</View>;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ ...accessibilityState, selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={classes}
      style={({ pressed }) => [
        typeof style === 'function' ? style({ pressed }) : style,
        {
          opacity: disabled
            ? interaction.disabledOpacity
            : pressed
              ? interaction.pressedOpacity
              : 1,
        },
      ]}
    >
      {content}
    </Pressable>
  );
}
