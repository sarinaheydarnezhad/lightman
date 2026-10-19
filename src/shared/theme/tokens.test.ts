import { palette, typography, spacing, radii, heights, shadows } from './tokens';
import { appearanceChoices } from '@/features/settings/presentation/appearance-options';

test('only light and dark themes are offered and have palettes', () => {
  expect(appearanceChoices.map((choice) => choice.value)).toEqual(['light', 'dark']);
  expect(Object.keys(palette)).toEqual(['light', 'dark']);
});

test('both appearances expose the same semantic colors with distinct surfaces', () => {
  const keys = Object.keys(palette.light);
  for (const colors of Object.values(palette)) {
    expect(Object.keys(colors)).toEqual(keys);
    for (const color of Object.values(colors)) expect(color).toMatch(/^#[0-9A-F]{6}$/i);
  }
  expect(palette.light.background).not.toBe(palette.light.surface);
  expect(palette.dark.background).not.toBe(palette.dark.surface);
  expect(palette.dark.background).not.toBe(palette.light.background);
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
      [colors.primaryText, colors.background],
      [colors.secondaryText, colors.background],
      [colors.tertiaryText, colors.background],
      [colors.primaryText, colors.surface],
      [colors.primaryForeground, colors.primary],
      [colors.primaryForeground, colors.primaryPressed],
      [colors.primary, colors.primarySoft],
      [colors.primary, colors.background],
      [colors.successForeground, colors.success],
      [colors.errorForeground, colors.error],
      [colors.errorForeground, colors.errorPressed],
      [colors.warningForeground, colors.warning],
      [colors.infoForeground, colors.info],
      [colors.info, colors.background],
      [colors.disabled, colors.surfaceElevated],
    ];
    for (const [foreground, background] of pairs) {
      const first = luminance(foreground!);
      const second = luminance(background!);
      expect(
        (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05),
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
});
