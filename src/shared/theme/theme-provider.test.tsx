import { act, render, screen } from '@testing-library/react-native';
import { setTestTheme } from '@/../test/set-test-theme';
import { ThemeProvider, useThemeColors, useThemeMode } from './theme-provider';
import { Text } from '@/shared/ui/text';

function ThemeReading() {
  const mode = useThemeMode();
  const colors = useThemeColors();
  return (
    <Text>
      {mode}: {colors.background}
    </Text>
  );
}

afterEach(async () => setTestTheme('system'));

test('switches appearance from UserSettings and updates semantic values', async () => {
  await setTestTheme('light');
  render(
    <ThemeProvider>
      <ThemeReading />
    </ThemeProvider>,
  );
  expect(screen.getByText('light: #F7F8FA')).toBeTruthy();

  await act(async () => setTestTheme('dark'));
  expect(screen.getByText('dark: #111723')).toBeTruthy();

  await act(async () => setTestTheme('oled'));
  expect(screen.getByText('oled: #000000')).toBeTruthy();
});
