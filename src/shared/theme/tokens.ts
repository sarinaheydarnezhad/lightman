import values from './values.json';

export type ThemeMode = keyof typeof values.colors;
export type ThemePreference = 'system' | ThemeMode;
export type SemanticColor = keyof (typeof values.colors)['light'];
export type TypographyVariant = keyof typeof values.typography;

export const palette = values.colors;
export const typography = values.typography;
export const spacing = values.spacing;
export const radii = values.radii;
export const heights = values.heights;
export const icons = values.icons;
export const interaction = values.interaction;
export const layout = values.layout;
export const shadows = values.shadows;

export function resolveTheme(
  preference: ThemePreference,
  system: 'light' | 'dark' | null,
): ThemeMode {
  return preference === 'system' ? (system ?? 'light') : preference;
}
