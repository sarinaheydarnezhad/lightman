import type { ThemeMode } from '@/features/settings/domain/user-settings';

export const appearanceChoices: readonly { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
