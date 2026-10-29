import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { runMigrations } from '@/core/database/migrations';
import { defaultSettings } from '@/core/composition/default-settings';
import {
  initializeSettingsDefaults,
  SQLiteSettingsRepository,
} from '@/features/settings/data/sqlite-settings-repository';
import { SyncStore } from './sync-store';
import type { ServerChange } from './contract';

test('fresh device defaults do not upload, but explicit settings edits are preserved', async () => {
  const database = await RealSqliteDatabase.open();
  try {
    await runMigrations(database);
    await initializeSettingsDefaults(database, defaultSettings());
    const store = new SyncStore(database);
    expect(await store.pending()).toHaveLength(0);
    const settings = new SQLiteSettingsRepository(database);
    expect(await settings.get()).toEqual(defaultSettings());
    await settings.update({ ...defaultSettings(), theme: 'dark' });
    await initializeSettingsDefaults(database, defaultSettings());
    expect((await settings.get())!.theme).toBe('dark');
    expect(await store.pending()).toHaveLength(1);
  } finally {
    database.handle.close();
  }
});

test('failed default initialization rolls back both the placeholder and the queue suppression flag', async () => {
  const database = await RealSqliteDatabase.open();
  try {
    await runMigrations(database);
    database.failStatement = 'INSERT INTO user_settings';
    await expect(initializeSettingsDefaults(database, defaultSettings())).rejects.toThrow();
    database.failStatement = null;
    expect(
      (await database.execute('SELECT applying_remote FROM sync_account')).rows[0]!.applying_remote,
    ).toBe(0);
    expect((await database.execute('SELECT * FROM user_settings')).rows).toHaveLength(0);
    await initializeSettingsDefaults(database, defaultSettings());
    expect(await new SyncStore(database).pending()).toHaveLength(0);
  } finally {
    database.handle.close();
  }
});

test.each(['deck', 'card'])(
  'fresh install materializes an archived %s snapshot before its dependent history',
  async (archivedType) => {
    const database = await RealSqliteDatabase.open();
    try {
      await runMigrations(database);
      const common = { deviceId: 'device', clientChangedAtUtc: '2026-10-27T10:00:00.000Z' };
      const changes: ServerChange[] = [
        {
          ...common,
          entityType: 'deck',
          entityId: 'deck',
          operation: archivedType === 'deck' ? 'archive' : 'upsert',
          clientChangeId: 'one',
          serverVersion: 1,
          payload: {
            name: 'History',
            description: '',
            language: 'en',
            textAlignment: 'ltr',
            typographySize: 'medium',
            archivedAtUtc: archivedType === 'deck' ? common.clientChangedAtUtc : null,
          },
        },
        {
          ...common,
          entityType: 'card',
          entityId: 'card',
          operation: archivedType === 'card' ? 'archive' : 'upsert',
          clientChangeId: 'two',
          serverVersion: 2,
          payload: {
            deckId: 'deck',
            frontText: 'Word',
            meaning: 'Meaning',
            examples: [],
            archivedAtUtc: archivedType === 'card' ? common.clientChangedAtUtc : null,
          },
        },
        {
          ...common,
          entityType: 'reviewEvent',
          entityId: 'event',
          operation: 'create',
          clientChangeId: 'three',
          serverVersion: 3,
          payload: {
            deckId: 'deck',
            cardId: 'card',
            result: 'success',
            previousBox: 1,
            newBox: 2,
            reviewedAtUtc: common.clientChangedAtUtc,
            studySessionId: null,
          },
        },
      ];
      const store = new SyncStore(database);
      await store.applyPage({ cursor: 3, latestVersion: 3, hasMore: false, changes });
      expect((await store.account()).cursor).toBe(3);
      expect(
        (
          await database.execute(
            `SELECT archived_at FROM ${archivedType === 'deck' ? 'decks' : 'cards'}`,
          )
        ).rows[0]!.archived_at,
      ).not.toBeNull();
      expect((await database.execute('SELECT * FROM review_events')).rows).toHaveLength(1);
      expect(
        (await database.execute('SELECT total_reviews FROM card_review_state')).rows[0]!
          .total_reviews,
      ).toBe(1);
      expect(await store.pending()).toHaveLength(0);
    } finally {
      database.handle.close();
    }
  },
);
