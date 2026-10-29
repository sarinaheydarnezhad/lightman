import type { Database } from '@/core/database/database';
import { languageTag, type LanguageTag } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import type { SettingsRepository } from '../domain/settings-repository';
import type { UserSettings } from '../domain/user-settings';
import { resolveUiLanguage } from '@/shared/localization/localization';

/** Kept in guest/device storage, outside account sync and content transfers. */
export class DeviceLanguagePreference {
  private database: Database | null = null;
  private language: LanguageTag | null = null;
  private readonly listeners = new Set<() => void>();

  async initialize(database: Database, fallback: LanguageTag): Promise<void> {
    if (this.database) return;
    await database.execute(`CREATE TABLE IF NOT EXISTS local_device_preferences (
      id INTEGER PRIMARY KEY CHECK (id = 1), language TEXT NOT NULL
    )`);
    await database.execute(
      'INSERT OR IGNORE INTO local_device_preferences (id, language) VALUES (1, ?)',
      [resolveUiLanguage(fallback)],
    );
    const result = await database.execute(
      'SELECT language FROM local_device_preferences WHERE id = 1',
    );
    this.language = languageTag(resolveUiLanguage(String(result.rows[0]?.language ?? fallback)));
    this.database = database;
    this.listeners.forEach((listener) => listener());
  }

  snapshot = (): LanguageTag | null => this.language;

  async set(language: LanguageTag): Promise<void> {
    if (!this.database) throw new AppError('unavailable', 'Device settings are not ready.');
    const next = languageTag(resolveUiLanguage(language));
    if (this.language === next) return;
    await this.database.execute('UPDATE local_device_preferences SET language = ? WHERE id = 1', [
      next,
    ]);
    this.language = next;
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/** Account settings can change without replacing the language selected on this device. */
export class DeviceLanguageSettingsRepository implements SettingsRepository {
  private source: UserSettings | null = null;
  private cached: UserSettings | null = null;

  constructor(
    private readonly repository: SettingsRepository,
    private readonly preference: DeviceLanguagePreference,
  ) {}

  async get(): Promise<UserSettings | null> {
    await this.repository.get();
    return this.snapshot();
  }

  async update(settings: UserSettings): Promise<UserSettings> {
    const previousLanguage = this.preference.snapshot();
    const next = await this.repository.update(settings);
    if (previousLanguage !== null && previousLanguage !== next.language)
      await this.preference.set(next.language);
    return this.snapshot()!;
  }

  snapshot = (): UserSettings | null => {
    const source = this.repository.snapshot();
    const language = this.preference.snapshot() ?? source?.language;
    if (source !== this.source || language !== this.cached?.language) {
      this.source = source;
      this.cached = source && language ? { ...source, language } : null;
    }
    return this.cached;
  };

  subscribe(listener: () => void): () => void {
    const stopSettings = this.repository.subscribe(listener);
    const stopLanguage = this.preference.subscribe(listener);
    return () => {
      stopSettings();
      stopLanguage();
    };
  }
}
