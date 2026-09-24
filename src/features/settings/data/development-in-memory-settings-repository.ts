import { validateUserSettings, type UserSettings } from '../domain/user-settings';
import type { SettingsRepository } from '../domain/settings-repository';

/** Temporary session-only adapter. */
export class InMemorySettingsRepository implements SettingsRepository {
  private settings: UserSettings | null = null;

  async get(): Promise<UserSettings | null> {
    return this.settings ? { ...this.settings } : null;
  }

  async update(settings: UserSettings): Promise<UserSettings> {
    this.settings = validateUserSettings(settings);
    return { ...this.settings };
  }
}
