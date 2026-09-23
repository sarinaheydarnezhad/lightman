import { act, render, screen } from '@testing-library/react-native';
import { useUiStore } from '@/store/ui-store';
import { ThemeProvider, useThemeColors, useThemeMode } from './theme-provider';
import { Text } from '@/shared/ui/text';

function ThemeReading() {
  const mode = useThemeMode();
  const colors = useThemeColors();
  return <Text>{mode}: {colors.background}</Text>;
}

afterEach(() => useUiStore.setState({ themePreference: 'system' }));

test('switches appearance from the session preference and updates semantic values', () => {
  useUiStore.setState({ themePreference: 'light' });
  render(<ThemeProvider><ThemeReading /></ThemeProvider>);
  expect(screen.getByText('light: #F7F8FA')).toBeTruthy();

  act(() => useUiStore.getState().setThemePreference('dark'));
  expect(screen.getByText('dark: #111723')).toBeTruthy();

  act(() => useUiStore.getState().setThemePreference('oled'));
  expect(screen.getByText('oled: #000000')).toBeTruthy();
});
