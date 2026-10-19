import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { makeSettings } from '@/../test/fixtures';
import { runMigrations } from '@/core/database/migrations';
import { SQLiteSettingsRepository } from './sqlite-settings-repository';

test.each(['light', 'dark'] as const)(
  '%s preference survives reopening the settings repository',
  async (theme) => {
    const database = await RealSqliteDatabase.open();
    try {
      await runMigrations(database);
      const first = new SQLiteSettingsRepository(database);
      await first.update(makeSettings({ theme }));
      const reopened = new SQLiteSettingsRepository(database);
      expect(await reopened.get()).toMatchObject({ theme });
      expect(reopened.snapshot()?.theme).toBe(theme);
    } finally {
      database.handle.close();
    }
  },
);

test.each([
  ['system', 'light'],
  ['oled', 'dark'],
] as const)(
  'legacy stored %s preference loads as %s and can be saved using the new themes',
  async (legacy, expected) => {
    const database = await RealSqliteDatabase.open();
    try {
      await runMigrations(database);
      const repository = new SQLiteSettingsRepository(database);
      await repository.update(makeSettings());
      await database.execute('UPDATE user_settings SET theme = ? WHERE id = 1', [legacy]);
      const reopened = new SQLiteSettingsRepository(database);
      const settings = await reopened.get();
      expect(settings?.theme).toBe(expected);
      await reopened.update({ ...settings!, theme: 'dark' });
      expect((await database.execute('SELECT theme FROM user_settings')).rows[0]?.theme).toBe(
        'dark',
      );
    } finally {
      database.handle.close();
    }
  },
);
