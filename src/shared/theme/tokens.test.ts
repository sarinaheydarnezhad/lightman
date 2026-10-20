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

test('dark surfaces are neutral charcoal with restrained semantic accents', () => {
  expect(palette.dark).toMatchObject({
    background: '#141414',
    surface: '#202020',
    surfaceElevated: '#2B2B2B',
    primaryText: '#F5F5F5',
    secondaryText: '#A1A1AA',
    tertiaryText: '#A1A1AA',
    primary: '#A78BFA',
    secondaryAccent: '#C4B5FD',
    achievement: '#F59E0B',
    decorativeIcon: '#A1A1AA',
  });
  for (const color of [
    palette.dark.background,
    palette.dark.surface,
    palette.dark.surfaceElevated,
    palette.dark.primarySoft,
    palette.dark.border,
    palette.dark.primaryForeground,
    palette.dark.overlay,
  ]) {
    expect(color.slice(1, 3)).toBe(color.slice(3, 5));
    expect(color.slice(3, 5)).toBe(color.slice(5, 7));
  }
});

test('light colors and the original semantic status colors remain unchanged', () => {
  expect(palette.light).toEqual({
    background: '#F6F5FD',
    surface: '#FFFFFF',
    surfaceElevated: '#EEEAF9',
    primaryText: '#17132D',
    secondaryText: '#5D587C',
    tertiaryText: '#736D88',
    border: '#E4DFF3',
    primary: '#6543AE',
    primaryPressed: '#523596',
    primarySoft: '#ECE8FF',
    primaryForeground: '#FFFFFF',
    secondaryAccent: '#6543AE',
    achievement: '#6543AE',
    decorativeIcon: '#6543AE',
    success: '#216B4B',
    successForeground: '#FFFFFF',
    warning: '#805419',
    warningForeground: '#FFFFFF',
    error: '#A63248',
    errorPressed: '#8C2538',
    errorForeground: '#FFFFFF',
    info: '#305F7B',
    infoForeground: '#FFFFFF',
    disabled: '#6B6474',
    overlay: '#17131F',
  });
  expect(palette.dark).toMatchObject({
    success: '#8BD5AF',
    successForeground: '#182E25',
    warning: '#EDC58D',
    warningForeground: '#382916',
    error: '#F3A3B2',
    errorPressed: '#DB8C9C',
    errorForeground: '#371C25',
    info: '#9DCBE1',
    infoForeground: '#1A2C36',
  });
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
      [colors.primaryText, colors.surfaceElevated],
      [colors.secondaryText, colors.surface],
      [colors.secondaryText, colors.surfaceElevated],
      [colors.primaryForeground, colors.primary],
      [colors.primaryForeground, colors.primaryPressed],
      [colors.primary, colors.primarySoft],
      [colors.primary, colors.background],
      [colors.primary, colors.surfaceElevated],
      [colors.secondaryAccent, colors.surfaceElevated],
      [colors.achievement, colors.surface],
      [colors.decorativeIcon, colors.primarySoft],
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
