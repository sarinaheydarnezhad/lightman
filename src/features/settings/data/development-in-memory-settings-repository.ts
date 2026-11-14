import { validateUserSettings, type UserSettings } from '../domain/user-settings';
import type { SettingsRepository } from '../domain/settings-repository';

/** Temporary session-only adapter. */
export class InMemorySettingsRepository implements SettingsRepository {
  private settings: UserSettings | null = null;
  private readonly listeners = new Set<() => void>();

  async get(): Promise<UserSettings | null> {
    return this.settings ? { ...this.settings } : null;
  }

  async initialize(settings: UserSettings, assertCurrentOwner = () => {}): Promise<UserSettings> {
    assertCurrentOwner();
    return this.settings ? { ...this.settings } : this.update(settings, assertCurrentOwner);
  }

  async update(
    settings: Partial<UserSettings>,
    assertCurrentOwner = () => {},
  ): Promise<UserSettings> {
    assertCurrentOwner();
    this.settings = validateUserSettings({ ...this.settings, ...settings } as UserSettings);
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
