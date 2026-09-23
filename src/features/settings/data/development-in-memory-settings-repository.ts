import type { SettingsRepository, StudySettings } from '../domain/settings-repository';

/** Temporary session-only adapter. */
export class DevelopmentInMemorySettingsRepository implements SettingsRepository {
  private settings: StudySettings | null = null;

  async get(): Promise<StudySettings | null> {
    return this.settings ? { ...this.settings } : null;
  }

  async save(settings: StudySettings): Promise<void> {
    this.settings = { ...settings };
  }
}
