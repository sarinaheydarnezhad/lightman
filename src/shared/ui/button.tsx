import { Pressable, type PressableProps } from 'react-native';
import { Text } from './text';

type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: 'primary' | 'outline';
};

export function Button({ label, variant = 'primary', disabled, ...props }: ButtonProps) {
  const appearance = variant === 'primary' ? 'bg-accent border-accent' : 'bg-surface border-border';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`min-h-12 items-center justify-center rounded-xl border px-5 ${appearance} ${disabled ? 'opacity-50' : ''}`}
      disabled={disabled}
      {...props}
    >
      <Text
        className={variant === 'primary' ? 'font-semibold text-accent-contrast' : 'font-semibold'}
      >
        {label}
      </Text>
    </Pressable>
  );
}
