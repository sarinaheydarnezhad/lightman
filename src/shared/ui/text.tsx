import { Children, isValidElement, type ReactNode } from 'react';
import { getTextDirection } from '@/shared/localization/localization';
import { Text as NativeText, type TextProps, type TextStyle } from 'react-native';
import { useLocalization } from '@/shared/localization/localization-provider';
import { fontFamilyForWeight, type AppFontWeight } from '@/shared/theme/font';
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
    | 'info'
    | SemanticColor;
  weight?: AppFontWeight;
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
  info: 'text-info',
  background: 'text-background',
  surface: 'text-surface',
  surfaceElevated: 'text-surfaceElevated',
  primaryText: 'text-primaryText',
  secondaryText: 'text-secondaryText',
  tertiaryText: 'text-tertiaryText',
  border: 'text-border',
  primaryPressed: 'text-primaryPressed',
  primarySoft: 'text-primarySoft',
  primaryForeground: 'text-primaryForeground',
  successForeground: 'text-successForeground',
  errorForeground: 'text-errorForeground',
  errorPressed: 'text-errorPressed',
  warningForeground: 'text-warningForeground',
  infoForeground: 'text-infoForeground',
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

function contentText(children: ReactNode): string {
  return Children.toArray(children).map((child) => {
    if (typeof child === 'string' || typeof child === 'number') return String(child);
    return isValidElement<{ children?: ReactNode }>(child) ? contentText(child.props.children) : '';
  }).join('');
}

export function Text({
  variant = 'bodyMedium',
  tone = 'primary',
  weight,
  align = 'auto',
  truncate,
  numberOfLines,
  className,
  style,
  children,
  ...props
}: AppTextProps) {
  const { direction: fallbackDirection } = useLocalization();
  const content = contentText(children);
  const direction = /[\p{Letter}\u200e\u200f]/u.test(content)
    ? getTextDirection(content)
    : fallbackDirection;
  const resolvedWeight: AppFontWeight =
    weight ??
    (variant === 'display' || variant === 'headingLarge'
      ? 'bold'
      : variant === 'headingMedium' ||
          variant === 'headingSmall' ||
          variant === 'labelLarge' ||
          variant === 'labelMedium'
        ? 'semibold'
        : variant === 'caption'
          ? 'medium'
          : 'regular');
  const textAlign: TextStyle['textAlign'] =
    align === 'center' || align === 'justify'
      ? align
      : align === 'end'
        ? direction === 'rtl'
          ? 'left'
          : 'right'
        : direction === 'rtl'
          ? 'right'
          : 'left';
  const baseStyle = {
    fontFamily: fontFamilyForWeight(resolvedWeight),
    writingDirection: direction,
    textAlign,
  } as const;
  const mergedStyle = Array.isArray(style)
    ? [baseStyle, ...style]
    : style
      ? { ...baseStyle, ...style }
      : baseStyle;
  return (
    <NativeText
      allowFontScaling
      numberOfLines={truncate ? (numberOfLines ?? 1) : numberOfLines}
      className={`${variantClass[variant]} ${toneClass[tone]} ${weight ? weightClass[weight] : ''} ${className ?? ''}`}
      style={mergedStyle}
      {...props}
      children={children}
    />
  );
}
