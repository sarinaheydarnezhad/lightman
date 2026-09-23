import { resolveTheme } from './tokens';

test('system preference follows the device and explicit preference overrides it', () => {
  expect(resolveTheme('system', 'dark')).toBe('dark');
  expect(resolveTheme('system', null)).toBe('light');
  expect(resolveTheme('light', 'dark')).toBe('light');
});
