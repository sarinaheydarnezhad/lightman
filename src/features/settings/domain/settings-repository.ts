import type { UserSettings } from './user-settings';

export interface SettingsRepository {
  /** Stable owner/database identity shared by decorators and multiple entry points. */
  readonly mutationScope?: object;
  get(): Promise<UserSettings | null>;
  initialize(settings: UserSettings, assertCurrentOwner?: () => void): Promise<UserSettings>;
  /** Merge only supplied fields with durable settings; validate and commit atomically. */
  update(settings: Partial<UserSettings>, assertCurrentOwner?: () => void): Promise<UserSettings>;
  /** Synchronous snapshot for global presentation; updated only after a successful write. */
  snapshot(): UserSettings | null;
  subscribe(listener: () => void): () => void;
}
