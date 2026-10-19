import { Platform, type ViewStyle } from 'react-native';
import { useThemeColors, useThemeMode } from './theme-provider';
import { shadows } from './tokens';

export function useSurfaceStyle(): ViewStyle {
  const colors = useThemeColors();
  const mode = useThemeMode();
  const shadow = shadows.small;
  return Platform.OS === 'web'
    ? {
        boxShadow: `0px ${shadow.offset}px ${shadow.radius}px ${colors.primary}${mode === 'light' ? '12' : '18'}`,
      }
    : {
        shadowColor: colors.primary,
        shadowOpacity: shadow.opacity,
        shadowRadius: shadow.radius,
        shadowOffset: { width: 0, height: shadow.offset },
        elevation: shadow.elevation,
      };
}
