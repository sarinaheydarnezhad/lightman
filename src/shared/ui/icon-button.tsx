import { Pressable, type PressableProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useThemeColors } from '@/shared/theme/theme-provider';
import { icons, interaction } from '@/shared/theme/tokens';

type IconButtonProps = Omit<PressableProps, 'children'> & {
  icon: LucideIcon;
  label: string;
  variant?: 'secondary' | 'ghost';
};

export function IconButton({
  icon: Icon,
  label,
  variant = 'secondary',
  disabled,
  style,
  accessibilityState,
  ...props
}: IconButtonProps) {
  const color = useThemeColors().primaryText;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      className={`min-h-iconButton min-w-iconButton items-center justify-center rounded-md border ${variant === 'ghost' ? 'border-transparent bg-transparent' : 'border-border bg-surface'}`}
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
      disabled={disabled}
    >
      <Icon color={color} size={icons.medium} accessible={false} />
    </Pressable>
  );
}
