import { languageTag } from '@/core/domain/values';
import type { UserSettings } from '@/features/settings/domain/user-settings';

/** Session default; no backend or device storage is involved. */
export function defaultSettings(): UserSettings {
  return {
    theme: 'system',
    language: languageTag('en'),
    dailyReminderEnabled: false,
    dailyReminderTime: null,
    preferredSpeechLanguage: languageTag('en'),
    preferredSpeechAccent: null,
  };
}
