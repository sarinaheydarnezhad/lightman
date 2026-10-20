import { useId } from 'react';
import { Platform } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useThemeColors, useThemeMode } from '@/shared/theme/theme-provider';

export function StudyIllustration() {
  const colors = useThemeColors();
  const gradient = `books-${useId().replace(/:/g, '')}`;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 220 180"
      accessible={Platform.OS === 'web' ? undefined : false}
    >
      <Defs>
        <LinearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.primarySoft} />
          <Stop offset="0.5" stopColor={colors.primary} stopOpacity={0.72} />
          <Stop offset="1" stopColor={colors.primaryPressed} />
        </LinearGradient>
      </Defs>
      <Ellipse cx="115" cy="170" rx="99" ry="7" fill={colors.primary} opacity={0.09} />
      <G fill={`url(#${gradient})`}>
        <Path d="M92 143 Q85 143 85 155 Q85 168 96 168 H213 V146Z" />
        <Path d="M100 121 Q91 122 91 133 Q91 146 102 146 H214 V124Z" />
        <Path d="M98 99 Q88 99 88 112 Q88 124 100 124 H207 V103Z" />
      </G>
      <G fill={colors.surface}>
        <Path d="M154 148 H210 V163 H154 Q148 156 154 148Z" />
        <Path d="M167 127 H211 V141 H167 Q160 134 167 127Z" />
        <Path d="M159 106 H204 V119 H159 Q152 113 159 106Z" />
      </G>
      <G stroke={colors.primary} strokeWidth="0.8" opacity={0.2}>
        <Path d="M155 153 H209 M154 158 H209 M168 132 H209 M168 136 H209 M160 111 H203 M160 115 H203" />
      </G>
      <G fill={`url(#${gradient})`}>
        <Path d="M51 78 Q15 77 16 22 Q62 29 51 78Z" />
        <Path d="M61 99 Q60 46 111 50 Q98 99 61 99Z" />
        <Path d="M47 124 Q16 126 5 86 Q44 74 47 124Z" />
        <Path d="M31 140 H76 L68 171 H40Z" />
        <Rect x="29" y="133" width="49" height="11" rx="5" />
      </G>
      <G
        fill="none"
        stroke={colors.primaryPressed}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={0.8}
      >
        <Path d="M53 135 Q58 74 32 39 M54 119 Q65 80 92 63 M52 137 Q44 109 23 96" />
      </G>
      <Ellipse cx="54" cy="136" rx="23" ry="4" fill={colors.primaryPressed} opacity={0.28} />
    </Svg>
  );
}

export function StudyEmblem() {
  const colors = useThemeColors();
  const mode = useThemeMode();
  const gradient = `flame-${useId().replace(/:/g, '')}`;
  return (
    <Svg
      width="112"
      height="112"
      viewBox="0 0 112 112"
      accessible={Platform.OS === 'web' ? undefined : false}
    >
      <Defs>
        <LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={mode === 'light' ? '#FF8C28' : colors.achievement} />
          <Stop offset="1" stopColor={mode === 'light' ? '#FFC74E' : colors.achievement} />
        </LinearGradient>
      </Defs>
      <Circle cx="56" cy="56" r="47" fill="none" stroke={colors.primarySoft} strokeWidth="10" />
      <Circle
        cx="56"
        cy="56"
        r="47"
        fill="none"
        stroke={colors.achievement}
        strokeOpacity={0.65}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray="151 296"
        transform="rotate(-90 56 56)"
      />
      <Path
        d="M55 30 C76 42 60 48 72 51 C88 77 67 88 53 85 C28 81 34 61 43 51 C46 59 55 45 55 30Z"
        fill={`url(#${gradient})`}
      />
      <Path d="M56 53 C68 66 72 79 57 84 C44 84 43 73 50 65 C49 73 58 67 56 53Z" fill="#FFE798" />
    </Svg>
  );
}
