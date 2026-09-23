import { createContext, useContext, type PropsWithChildren } from 'react';
import { useColorScheme, View } from 'react-native';
import { vars } from 'nativewind';

import { useUiStore } from '@/store/ui-store';
import { palette, resolveTheme, type ThemeMode } from './tokens';

const ThemeContext = createContext<ThemeMode>('light');

function hexRgbChannels(hex: string): string {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `${red} ${green} ${blue}`;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const preference = useUiStore((state) => state.themePreference);
  const deviceScheme = useColorScheme();
  const mode = resolveTheme(
    preference,
    deviceScheme === 'light' || deviceScheme === 'dark' ? deviceScheme : null,
  );
  const colors = palette[mode];
  const variables = vars({
    '--color-background': hexRgbChannels(colors.background),
    '--color-surface': hexRgbChannels(colors.surface),
    '--color-foreground': hexRgbChannels(colors.foreground),
    '--color-muted': hexRgbChannels(colors.muted),
    '--color-border': hexRgbChannels(colors.border),
    '--color-accent': hexRgbChannels(colors.accent),
    '--color-accent-contrast': hexRgbChannels(colors.accentContrast),
    '--color-success': hexRgbChannels(colors.success),
    '--color-error': hexRgbChannels(colors.error),
    '--color-warning': hexRgbChannels(colors.warning),
  });

  return (
    <ThemeContext.Provider value={mode}>
      <View className={mode === 'dark' ? 'dark flex-1' : 'flex-1'} style={variables}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useThemeMode(): ThemeMode {
  return useContext(ThemeContext);
}
