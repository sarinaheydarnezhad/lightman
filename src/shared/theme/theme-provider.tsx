import { createContext, useContext, type PropsWithChildren } from 'react';
import { useColorScheme, View } from 'react-native';
import { vars } from 'nativewind';

import { useUiStore } from '@/store/ui-store';
import { palette, resolveTheme, type ThemeMode } from './tokens';

const ThemeContext = createContext<ThemeMode>('light');

function rgbChannels(hex: string): string {
  return [1, 3, 5]
    .map((position) => Number.parseInt(hex.slice(position, position + 2), 16))
    .join(' ');
}

const variables = Object.fromEntries(
  (Object.keys(palette) as ThemeMode[]).map((mode) => [
    mode,
    vars(
      Object.fromEntries(
        Object.entries(palette[mode]).map(([name, color]) => [
          `--color-${name}`,
          rgbChannels(color),
        ]),
      ),
    ),
  ]),
) as Record<ThemeMode, ReturnType<typeof vars>>;

export function ThemeProvider({ children }: PropsWithChildren) {
  const preference = useUiStore((state) => state.themePreference);
  const deviceScheme = useColorScheme();
  const mode = resolveTheme(
    preference,
    deviceScheme === 'dark' ? 'dark' : deviceScheme === 'light' ? 'light' : null,
  );

  return (
    <ThemeContext.Provider value={mode}>
      <View className="flex-1" style={variables[mode]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useThemeMode(): ThemeMode {
  return useContext(ThemeContext);
}

export function useThemeColors() {
  return palette[useThemeMode()];
}
