import type { UserSettings } from './user-settings';

export interface SettingsRepository {
  get(): Promise<UserSettings | null>;
  update(settings: UserSettings): Promise<UserSettings>;
  /** Synchronous snapshot for global presentation; updated only after a successful write. */
  snapshot(): UserSettings | null;
  subscribe(listener: () => void): () => void;
}
