import type { Database } from '@/core/database/database';
import {
  booleanValue,
  databaseOperation,
  encodeBoolean,
  nullableText,
  row,
  text,
} from '@/core/database/sqlite-repository-utils';
import { languageTag, localTime } from '@/core/domain/values';
import {
  validateUserSettings,
  type EnglishAccent,
  type UserSettings,
} from '../domain/user-settings';
import type { SettingsRepository } from '../domain/settings-repository';

function mapSettings(source: ReturnType<typeof row>): UserSettings | null {
  if (!source) return null;
  return validateUserSettings({
    theme: text(source, 'theme') as UserSettings['theme'],
    hapticsEnabled: booleanValue(source, 'haptics_enabled'),
    language: languageTag(text(source, 'language')),
    dailyReminderEnabled: booleanValue(source, 'daily_reminder_enabled'),
    dailyReminderTime: nullableText(source, 'daily_reminder_time')
      ? localTime(nullableText(source, 'daily_reminder_time')!)
      : null,
    preferredSpeechLanguage: languageTag(text(source, 'preferred_speech_language')),
    preferredSpeechAccent: nullableText(source, 'preferred_speech_accent') as EnglishAccent | null,
  });
}

export class SQLiteSettingsRepository implements SettingsRepository {
  private cached: UserSettings | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly database: Database) {}

  get(): Promise<UserSettings | null> {
    return databaseOperation(async () => {
      const result = await this.database.execute('SELECT * FROM settings WHERE id = 1');
      this.cached = mapSettings(row(result));
      return this.cached;
    }, 'Unable to load settings.');
  }

  update(settings: UserSettings): Promise<UserSettings> {
    return databaseOperation(async () => {
      const valid = validateUserSettings(settings);
      await this.database.execute(
        `INSERT INTO settings (id, theme, haptics_enabled, language, daily_reminder_enabled, daily_reminder_time, preferred_speech_language, preferred_speech_accent)
           VALUES (1, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET theme = excluded.theme, haptics_enabled = excluded.haptics_enabled,
             language = excluded.language, daily_reminder_enabled = excluded.daily_reminder_enabled,
             daily_reminder_time = excluded.daily_reminder_time, preferred_speech_language = excluded.preferred_speech_language,
             preferred_speech_accent = excluded.preferred_speech_accent`,
        [
          valid.theme,
          encodeBoolean(valid.hapticsEnabled),
          valid.language,
          encodeBoolean(valid.dailyReminderEnabled),
          valid.dailyReminderTime,
          valid.preferredSpeechLanguage,
          valid.preferredSpeechAccent,
        ],
      );
      this.cached = valid;
      this.listeners.forEach((listener) => listener());
      return valid;
    }, 'Unable to save settings.');
  }

  snapshot(): UserSettings | null {
    return this.cached ? { ...this.cached } : null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
