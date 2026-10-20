import { act, render, screen } from '@testing-library/react-native';
import { Platform, View } from 'react-native';
import { Stop } from 'react-native-svg';

import { setTestTheme } from '@/../test/set-test-theme';
import { ScreenBackdrop } from './screen-backdrop';
import { ThemeProvider } from './theme-provider';
import { palette, shadows } from './tokens';
import { useSurfaceStyle } from './use-surface-style';

function SurfacePreview() {
  return (
    <View testID="surface-shadow" style={useSurfaceStyle()}>
      <ScreenBackdrop />
    </View>
  );
}

afterEach(async () => {
  jest.restoreAllMocks();
  await setTestTheme('light');
});

test.each(['web', 'ios', 'android'] as const)(
  '%s backgrounds and shadows switch to neutral colors and restore light colors',
  async (platform) => {
    jest.replaceProperty(Platform, 'OS', platform);
    await setTestTheme('light');
    render(
      <ThemeProvider>
        <SurfacePreview />
      </ThemeProvider>,
    );

    for (const mode of ['light', 'dark', 'light'] as const) {
      await act(async () => setTestTheme(mode));
      const colors = palette[mode];
      expect(screen.UNSAFE_getAllByType(Stop).map((stop) => stop.props.stopColor)).toEqual([
        mode === 'light' ? colors.primarySoft : colors.background,
        colors.background,
        colors.background,
      ]);
      const shadowColor = mode === 'light' ? colors.primary : colors.overlay;
      expect(screen.getByTestId('surface-shadow')).toHaveStyle(
        platform === 'web'
          ? {
              boxShadow: `0px ${shadows.small.offset}px ${shadows.small.radius}px ${shadowColor}${mode === 'light' ? '12' : '18'}`,
            }
          : { shadowColor },
      );
    }
  },
);
