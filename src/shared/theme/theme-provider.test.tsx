import { act, render, screen } from '@testing-library/react-native';
import { setTestTheme } from '@/../test/set-test-theme';
import { ThemeProvider, useThemeColors, useThemeMode } from './theme-provider';
import { Text } from '@/shared/ui/text';
import { palette } from './tokens';

function ThemeReading() {
  const mode = useThemeMode();
  const colors = useThemeColors();
  return (
    <Text>
      {mode}: {colors.background}
    </Text>
  );
}

afterEach(async () => setTestTheme('light'));

test('switches appearance from UserSettings and updates semantic values', async () => {
  await setTestTheme('light');
  render(
    <ThemeProvider>
      <ThemeReading />
    </ThemeProvider>,
  );
  expect(screen.getByText(`light: ${palette.light.background}`)).toBeTruthy();

  await act(async () => setTestTheme('dark'));
  expect(screen.getByText(`dark: ${palette.dark.background}`)).toBeTruthy();

  await act(async () => setTestTheme('light'));
  expect(screen.getByText(`light: ${palette.light.background}`)).toBeTruthy();
});
