import { Text as NativeText, type TextProps } from 'react-native';

type AppTextProps = TextProps & { tone?: 'primary' | 'secondary' | 'accent' | 'error' };

const toneClass = {
  primary: 'text-foreground',
  secondary: 'text-muted',
  accent: 'text-accent',
  error: 'text-error',
} as const;

export function Text({ tone = 'primary', className, ...props }: AppTextProps) {
  return <NativeText className={`${toneClass[tone]} text-base ${className ?? ''}`} {...props} />;
}
