import type { ThemePreference } from '@/store/ui-store';

export const appearanceChoices: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Follow system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'oled', label: 'OLED' },
];
