import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useThemeColors } from '@/shared/theme/theme-provider';
import { icons, interaction } from '@/shared/theme/tokens';

type IconButtonProps = Omit<PressableProps, 'children'> & {
  icon: LucideIcon;
  label: string;
  variant?: 'secondary' | 'ghost';
  tone?: 'default' | 'success';
  loading?: boolean;
};

export function IconButton({
  icon: Icon,
  label,
  variant = 'secondary',
  tone = 'default',
  loading = false,
  disabled,
  style,
  accessibilityState,
  ...props
}: IconButtonProps) {
  const colors = useThemeColors();
  const color = tone === 'success' ? colors.success : colors.primaryText;
  const unavailable = disabled || loading;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ ...accessibilityState, disabled: !!unavailable, busy: loading }}
      className={`min-h-iconButton min-w-iconButton items-center justify-center rounded-md border ${variant === 'ghost' ? 'border-transparent bg-transparent' : 'border-border bg-surface'}`}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        {
          opacity: unavailable
            ? interaction.disabledOpacity
            : state.pressed
              ? interaction.pressedOpacity
              : 1,
        },
      ]}
      disabled={unavailable}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <Icon color={color} size={icons.medium} />
      )}
    </Pressable>
  );
}
