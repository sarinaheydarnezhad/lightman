import { validateUserSettings, type UserSettings } from '../domain/user-settings';
import type { SettingsRepository } from '../domain/settings-repository';

/** Temporary session-only adapter. */
export class InMemorySettingsRepository implements SettingsRepository {
  private settings: UserSettings | null = null;
  private readonly listeners = new Set<() => void>();

  async get(): Promise<UserSettings | null> {
    return this.settings ? { ...this.settings } : null;
  }

  async update(settings: UserSettings): Promise<UserSettings> {
    this.settings = validateUserSettings(settings);
    this.listeners.forEach((listener) => listener());
    return { ...this.settings };
  }

  snapshot(): UserSettings | null {
    return this.settings;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
