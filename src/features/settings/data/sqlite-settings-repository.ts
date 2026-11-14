import type { Database } from '@/core/database/database';
import { SerialWork } from '@/core/application/serial-work';
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
import { resolveUiLanguage } from '@/shared/localization/localization';
import type { SettingsRepository } from '../domain/settings-repository';

const states = new WeakMap<
  Database,
  {
    work: SerialWork;
    cached: UserSettings | null;
    listeners: Set<() => void>;
  }
>();
function stateFor(database: Database) {
  let state = states.get(database);
  if (!state) {
    state = { work: new SerialWork(), cached: null, listeners: new Set() };
    states.set(database, state);
  }
  return state;
}

/** Device defaults are placeholders until the account has been pulled, not user edits. */
export async function initializeSettingsDefaults(
  database: Database,
  settings: UserSettings,
): Promise<void> {
  const valid = validateUserSettings(settings);
  await stateFor(database).work.run(() =>
    database.transaction(async (transaction) => {
      if ((await transaction.execute('SELECT id FROM user_settings WHERE id = 1')).rows.length)
        return;
      const flag = (
        await transaction.execute('SELECT applying_remote FROM sync_account WHERE id = 1')
      ).rows[0]?.applying_remote;
      await transaction.execute('UPDATE sync_account SET applying_remote = 1 WHERE id = 1');
      await transaction.execute(
        `INSERT INTO user_settings (id, theme, haptics_enabled, language, daily_reminder_enabled, daily_reminder_time, preferred_speech_language, preferred_speech_accent)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
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
      await transaction.execute('UPDATE sync_account SET applying_remote = ? WHERE id = 1', [
        flag ?? 0,
      ]);
    }),
  );
}

function mapSettings(source: ReturnType<typeof row>): UserSettings | null {
  if (!source) return null;
  return validateUserSettings({
    theme: text(source, 'theme') as UserSettings['theme'],
    hapticsEnabled: booleanValue(source, 'haptics_enabled'),
    language: languageTag(resolveUiLanguage(text(source, 'language'))),
    dailyReminderEnabled: booleanValue(source, 'daily_reminder_enabled'),
    dailyReminderTime: nullableText(source, 'daily_reminder_time')
      ? localTime(nullableText(source, 'daily_reminder_time')!)
      : null,
    preferredSpeechLanguage: languageTag(
      resolveUiLanguage(text(source, 'preferred_speech_language')),
    ),
    preferredSpeechAccent: nullableText(source, 'preferred_speech_accent') as EnglishAccent | null,
  });
}

export class SQLiteSettingsRepository implements SettingsRepository {
  readonly mutationScope: object;
  private readonly state;

  constructor(private readonly database: Database) {
    this.mutationScope = database;
    this.state = stateFor(database);
  }

  private publish(next: UserSettings | null) {
    const changed = JSON.stringify(this.state.cached) !== JSON.stringify(next);
    this.state.cached = next;
    if (changed) this.state.listeners.forEach((listener) => listener());
  }

  get(): Promise<UserSettings | null> {
    return this.state.work.run(() =>
      databaseOperation(async () => {
        const result = await this.database.execute('SELECT * FROM user_settings WHERE id = 1');
        const next = mapSettings(row(result));
        this.publish(next);
        return next;
      }, 'Unable to load settings.'),
    );
  }

  update(settings: Partial<UserSettings>, assertCurrentOwner = () => {}): Promise<UserSettings> {
    return this.persist(settings, assertCurrentOwner, false);
  }

  initialize(settings: UserSettings, assertCurrentOwner = () => {}): Promise<UserSettings> {
    return this.persist(settings, assertCurrentOwner, true);
  }

  private persist(
    settings: Partial<UserSettings>,
    assertCurrentOwner: () => void,
    onlyIfMissing: boolean,
  ): Promise<UserSettings> {
    return this.state.work.run(() =>
      databaseOperation(async () => {
        let valid!: UserSettings;
        await this.database.transaction(async (transaction) => {
          assertCurrentOwner();
          const previous = mapSettings(
            row(await transaction.execute('SELECT * FROM user_settings WHERE id = 1')),
          );
          if (onlyIfMissing && previous) {
            valid = previous;
            return;
          }
          valid = validateUserSettings({ ...previous, ...settings } as UserSettings);
          assertCurrentOwner();
          await transaction.execute(
            `INSERT INTO user_settings (id, theme, haptics_enabled, language, daily_reminder_enabled, daily_reminder_time, preferred_speech_language, preferred_speech_accent)
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
          assertCurrentOwner();
        });
        this.publish(valid);
        return valid;
      }, 'Unable to save settings.'),
    );
  }

  snapshot(): UserSettings | null {
    return this.state.cached;
  }

  subscribe(listener: () => void): () => void {
    this.state.listeners.add(listener);
    return () => this.state.listeners.delete(listener);
  }
}
