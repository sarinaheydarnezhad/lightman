import { languageTag, localTime } from '@/core/domain/values';
import type { UserSettings } from '@/features/settings/domain/user-settings';

/** Session default; no backend or device storage is involved. */
export function defaultSettings(): UserSettings {
  return {
    theme: 'system',
    hapticsEnabled: true,
    language: languageTag('en'),
    dailyReminderEnabled: false,
    dailyReminderTime: localTime('09:00'),
    preferredSpeechLanguage: languageTag('en'),
    preferredSpeechAccent: null,
  };
}
