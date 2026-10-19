import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useThemeColors } from './theme-provider';

export function ScreenBackdrop() {
  const colors = useThemeColors();
  const gradient = `screen-${useId().replace(/:/g, '')}`;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primarySoft} stopOpacity={0.85} />
            <Stop offset="0.55" stopColor={colors.background} />
            <Stop offset="1" stopColor={colors.background} />
          </LinearGradient>
        </Defs>
        <Rect width="390" height="844" fill={`url(#${gradient})`} />
        <Path d="M0 88 Q86 18 166 104 T390 158 V0 H0Z" fill={colors.surface} opacity={0.2} />
        <Path d="M0 205 Q110 252 220 176 T390 192 V0 H0Z" fill={colors.surface} opacity={0.12} />
      </Svg>
    </View>
  );
}
