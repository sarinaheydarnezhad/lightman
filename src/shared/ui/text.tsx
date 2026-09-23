import { I18nManager, Text as NativeText, type TextProps } from 'react-native';
import type { SemanticColor, TypographyVariant } from '@/shared/theme/tokens';

type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  tone?:
    | 'primary'
    | 'secondary'
    | 'tertiary'
    | 'accent'
    | 'error'
    | 'success'
    | 'warning'
    | SemanticColor;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  align?: 'auto' | 'start' | 'center' | 'end' | 'justify';
  truncate?: boolean;
};

const toneClass = {
  primary: 'text-primaryText',
  secondary: 'text-secondaryText',
  tertiary: 'text-tertiaryText',
  accent: 'text-primary',
  error: 'text-error',
  success: 'text-success',
  warning: 'text-warning',
  background: 'text-background',
  surface: 'text-surface',
  surfaceElevated: 'text-surfaceElevated',
  primaryText: 'text-primaryText',
  secondaryText: 'text-secondaryText',
  tertiaryText: 'text-tertiaryText',
  border: 'text-border',
  primaryForeground: 'text-primaryForeground',
  successForeground: 'text-successForeground',
  errorForeground: 'text-errorForeground',
  warningForeground: 'text-warningForeground',
  disabled: 'text-disabled',
  overlay: 'text-overlay',
} as const;

const variantClass: Record<TypographyVariant, string> = {
  display: 'text-display',
  headingLarge: 'text-headingLarge',
  headingMedium: 'text-headingMedium',
  headingSmall: 'text-headingSmall',
  bodyLarge: 'text-bodyLarge',
  bodyMedium: 'text-bodyMedium',
  bodySmall: 'text-bodySmall',
  labelLarge: 'text-labelLarge',
  labelMedium: 'text-labelMedium',
  caption: 'text-caption',
};

const weightClass = {
  regular: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};
const alignClass = { auto: '', center: 'text-center', justify: 'text-justify' };

export function Text({
  variant = 'bodyMedium',
  tone = 'primary',
  weight,
  align = 'auto',
  truncate,
  numberOfLines,
  className,
  ...props
}: AppTextProps) {
  const alignment =
    align === 'start'
      ? I18nManager.isRTL
        ? 'text-right'
        : 'text-left'
      : align === 'end'
        ? I18nManager.isRTL
          ? 'text-left'
          : 'text-right'
        : alignClass[align];

  return (
    <NativeText
      allowFontScaling
      numberOfLines={truncate ? (numberOfLines ?? 1) : numberOfLines}
      className={`${variantClass[variant]} ${toneClass[tone]} ${weight ? weightClass[weight] : ''} ${alignment} ${className ?? ''}`}
      {...props}
    />
  );
}
