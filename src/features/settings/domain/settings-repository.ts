import type { UserSettings } from './user-settings';

export interface SettingsRepository {
  get(): Promise<UserSettings | null>;
  update(settings: UserSettings): Promise<UserSettings>;
}
