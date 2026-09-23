import { palette, resolveTheme, typography, spacing, radii, heights, shadows } from './tokens';

test('system preference follows the device and explicit preference overrides it', () => {
  expect(resolveTheme('system', 'dark')).toBe('dark');
  expect(resolveTheme('system', null)).toBe('light');
  expect(resolveTheme('light', 'dark')).toBe('light');
  expect(resolveTheme('system', 'light')).toBe('light');
  expect(resolveTheme('system', 'dark')).not.toBe('oled');
  expect(resolveTheme('oled', 'light')).toBe('oled');
  expect(resolveTheme('oled', 'dark')).toBe('oled');
});

test('every appearance exposes the same semantic colors and OLED has a true black base', () => {
  const keys = Object.keys(palette.light);
  for (const colors of Object.values(palette)) {
    expect(Object.keys(colors)).toEqual(keys);
    for (const color of Object.values(colors)) expect(color).toMatch(/^#[0-9A-F]{6}$/i);
  }
  expect(palette.oled.background).toBe('#000000');
  expect(palette.oled.surface).not.toBe(palette.oled.background);
  expect(palette.dark.background).not.toBe(palette.oled.background);
});

test('shared typography, spacing, radii, heights and elevation tokens are available', () => {
  expect(Object.keys(typography)).toHaveLength(10);
  expect(spacing['3xl']).toBeGreaterThan(spacing.xs);
  expect(radii.full).toBeGreaterThan(radii.xl);
  expect(heights.iconButton).toBeGreaterThanOrEqual(44);
  expect(shadows.none.elevation).toBe(0);
});

test('foreground and background semantic pairs remain readable in every theme', () => {
  function luminance(hex: string) {
    const channels = [1, 3, 5].map((position) => {
      const channel = Number.parseInt(hex.slice(position, position + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  }

  for (const colors of Object.values(palette)) {
    const pairs = [
      [colors.primaryText, colors.background], [colors.secondaryText, colors.background],
      [colors.tertiaryText, colors.background], [colors.primaryText, colors.surface],
      [colors.primaryForeground, colors.primary], [colors.successForeground, colors.success],
      [colors.errorForeground, colors.error], [colors.warningForeground, colors.warning],
    ];
    for (const [foreground, background] of pairs) {
      const first = luminance(foreground!);
      const second = luminance(background!);
      expect((Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  }
});
