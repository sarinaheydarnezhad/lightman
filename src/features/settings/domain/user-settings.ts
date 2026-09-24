import { languageTag, localTime, type LanguageTag, type LocalTime } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';

export type ThemeMode = 'system' | 'light' | 'dark' | 'oled';

export interface UserSettings {
  readonly theme: ThemeMode;
  readonly language: LanguageTag;
  readonly dailyReminderEnabled: boolean;
  readonly dailyReminderTime: LocalTime | null;
  readonly preferredSpeechLanguage: LanguageTag;
  readonly preferredSpeechAccent: string | null;
}

export function validateUserSettings(settings: UserSettings): UserSettings {
  if (!(['system', 'light', 'dark', 'oled'] as const).includes(settings.theme))
    throw new AppError('validation', 'Invalid theme.');
  const language = languageTag(settings.language);
  const preferredSpeechLanguage = languageTag(settings.preferredSpeechLanguage);
  if (typeof settings.dailyReminderEnabled !== 'boolean')
    throw new AppError('validation', 'Invalid reminder setting.');
  if (settings.dailyReminderTime !== null) localTime(settings.dailyReminderTime);
  if (settings.dailyReminderEnabled && settings.dailyReminderTime === null)
    throw new AppError('validation', 'A reminder time is required.');
  if (settings.preferredSpeechAccent !== null && settings.preferredSpeechAccent.trim().length > 100)
    throw new AppError('validation', 'Speech accent is too long.');
  return {
    ...settings,
    language,
    preferredSpeechLanguage,
    preferredSpeechAccent: settings.preferredSpeechAccent?.trim() || null,
  };
}
