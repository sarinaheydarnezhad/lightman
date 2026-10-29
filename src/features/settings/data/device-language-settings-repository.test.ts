import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { fixedClock, sequenceIds } from '@/../test/fixtures';
import { runMigrations } from '@/core/database/migrations';
import { languageTag } from '@/core/domain/values';
import { createApplication } from '@/core/application/create-application';
import { defaultSettings } from '@/core/composition/default-settings';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { LocalStorageScopes } from '@/core/storage/local-storage-scopes';
import { SyncStore } from '@/core/sync/sync-store';
import { initializeSettingsDefaults } from './sqlite-settings-repository';
import { DeviceLanguagePreference } from './device-language-settings-repository';

jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));

const owner = '11111111-1111-1111-1111-111111111111';

test.each(['fa', 'en'] as const)(
  '%s survives login, opposite account language, sync, logout and a device restart',
  async (language) => {
    const preference = new DeviceLanguagePreference();
    const files = new Map<string, RealSqliteDatabase>();
    const scopes = new LocalStorageScopes(async (name) => {
      const database = await RealSqliteDatabase.open();
      files.set(name, database);
      await runMigrations(database);
      await initializeSettingsDefaults(database, defaultSettings());
      const value = createSqliteRepositories(database, preference);
      await value.settings.get();
      return { database, value };
    });
    await scopes.initialize();
    const guest = scopes.current();
    await preference.initialize(guest.database!, defaultSettings().language);
    const app = () => createApplication(scopes.current().value, fixedClock, sequenceIds());
    await app().settings.setLanguage(languageTag(language));
    await scopes.enterAccount(owner);
    expect(await app().settings.get()).toMatchObject({ language });
    expect(app().settings.snapshot()?.language).toBe(language);
    const other = language === 'fa' ? 'en' : 'fa';
    const account = scopes.current();
    await new SyncStore(account.database!).applyPage({
      cursor: 1,
      latestVersion: 1,
      hasMore: false,
      changes: [
        {
          entityType: 'settings',
          entityId: '1',
          operation: 'upsert',
          deviceId: 'other-device',
          clientChangeId: 'remote-settings',
          clientChangedAtUtc: '2026-10-28T10:00:00.000Z',
          serverVersion: 1,
          payload: { ...defaultSettings(), language: other, theme: 'dark' },
        },
      ],
    });
    expect(await app().settings.get()).toMatchObject({ language, theme: 'dark' });
    expect(await new SyncStore(account.database!).pending()).toHaveLength(0);
    await app().settings.setLanguage(languageTag(other));
    expect(app().settings.snapshot()?.language).toBe(other);
    await scopes.enterEmptyGuest();
    expect((await app().settings.get())?.language).toBe(other);
    const saved = new Map([...files].map(([name, file]) => [name, file.handle.export()]));
    const reopenedPreference = new DeviceLanguagePreference();
    const reopenedScopes = new LocalStorageScopes(async (name) => {
      const database = await RealSqliteDatabase.open(saved.get(name));
      const value = createSqliteRepositories(database, reopenedPreference);
      await value.settings.get();
      return { database, value };
    });
    await reopenedScopes.initialize();
    await reopenedPreference.initialize(reopenedScopes.current().database!, languageTag(language));
    expect((await reopenedScopes.current().value.settings.get())?.language).toBe(other);
    await reopenedScopes.enterAccount(owner);
    expect((await reopenedScopes.current().value.settings.get())?.language).toBe(other);
    for (const database of files.values()) database.handle.close();
  },
);

test('first initialization adopts the current language without uploading a settings edit', async () => {
  const database = await RealSqliteDatabase.open();
  try {
    await runMigrations(database);
    const preference = new DeviceLanguagePreference();
    await preference.initialize(database, languageTag('fa'));
    expect(preference.snapshot()).toBe('fa');
    expect(await new SyncStore(database).pending()).toHaveLength(0);
  } finally {
    database.handle.close();
  }
});
