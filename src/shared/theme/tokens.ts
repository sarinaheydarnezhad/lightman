export type ThemeMode = 'light' | 'dark';

export const palette = {
  light: {
    background: '#F6F7FB',
    surface: '#FFFFFF',
    foreground: '#18223A',
    muted: '#657087',
    border: '#DEE3EC',
    accent: '#4258C9',
    accentContrast: '#FFFFFF',
    success: '#268354',
    error: '#BE3948',
    warning: '#A66A13',
  },
  dark: {
    background: '#121827',
    surface: '#1D2739',
    foreground: '#F4F6FA',
    muted: '#AFBBD0',
    border: '#39465B',
    accent: '#ABB9FF',
    accentContrast: '#121827',
    success: '#6BD6A1',
    error: '#FF929D',
    warning: '#F2BD6B',
  },
} as const;

export function resolveTheme(
  preference: 'system' | ThemeMode,
  system: ThemeMode | null,
): ThemeMode {
  return preference === 'system' ? (system ?? 'light') : preference;
}
