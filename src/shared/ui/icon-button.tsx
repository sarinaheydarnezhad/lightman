import { Pressable, type PressableProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useThemeMode } from '@/shared/theme/theme-provider';
import { palette } from '@/shared/theme/tokens';

type IconButtonProps = Omit<PressableProps, 'children'> & {
  icon: LucideIcon;
  label: string;
};

export function IconButton({ icon: Icon, label, ...props }: IconButtonProps) {
  const color = palette[useThemeMode()].foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-12 min-w-12 items-center justify-center rounded-xl border border-border bg-surface"
      {...props}
    >
      <Icon color={color} size={20} />
    </Pressable>
  );
}
