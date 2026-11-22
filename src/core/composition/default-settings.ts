import { languageTag, localTime } from '@/core/domain/values';
import type { UserSettings } from '@/features/settings/domain/user-settings';

export const DEFAULT_UI_LANGUAGE = 'fa';

/** Session default; no backend or device storage is involved. */
export function defaultSettings(): UserSettings {
  return {
    theme: 'light',
    hapticsEnabled: true,
    language: languageTag(DEFAULT_UI_LANGUAGE),
    dailyReminderEnabled: false,
    dailyReminderTime: localTime('09:00'),
    preferredSpeechLanguage: languageTag('en'),
    preferredSpeechAccent: null,
  };
}
