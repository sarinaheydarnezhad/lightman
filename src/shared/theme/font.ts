export const fontAssets = {
  Vazirmatn: require('../../../font/fonts/ttf/Vazirmatn-Regular.ttf'),
  'Vazirmatn-Medium': require('../../../font/fonts/ttf/Vazirmatn-Medium.ttf'),
  'Vazirmatn-SemiBold': require('../../../font/fonts/ttf/Vazirmatn-SemiBold.ttf'),
  'Vazirmatn-Bold': require('../../../font/fonts/ttf/Vazirmatn-Bold.ttf'),
} as const;

export type AppFontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export function fontFamilyForWeight(weight: AppFontWeight = 'regular'): string {
  return weight === 'bold'
    ? 'Vazirmatn-Bold'
    : weight === 'semibold'
      ? 'Vazirmatn-SemiBold'
      : weight === 'medium'
        ? 'Vazirmatn-Medium'
        : 'Vazirmatn';
}
