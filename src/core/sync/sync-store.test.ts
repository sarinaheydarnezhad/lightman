import type { Database, DatabaseTransaction, SqlResult, SqlValue } from '@/core/database/database';
import { SyncStore } from './sync-store';
import type { PullPage } from './contract';

class TransactionalDatabase implements Database {
  cursor = 0;
  writes: string[] = [];
  failInsert = false;
  pendingEdit = false;
  existingEvent = false;

  async execute(sql: string, _params?: readonly SqlValue[]): Promise<SqlResult> {
    if (sql.startsWith('SELECT cursor FROM sync_account')) return { rows: [{ cursor: this.cursor }], rowsAffected: 0 };
    if (sql.includes('FROM sync_operations WHERE entity_type')) {
      return { rows: this.pendingEdit ? [{ operation_id: 'local-edit', payload_json: '{"name":"mine"}' }] : [], rowsAffected: 0 };
    }
    if (sql.includes('FROM sync_operations WHERE operation_id')) return { rows: [], rowsAffected: 0 };
    if (this.existingEvent && sql.includes('FROM review_events WHERE id')) return { rows: [{
      card_id: 'card-one', deck_id: 'deck-one', previous_box: 1, new_box: 2,
      result: 'success', reviewed_at: '2026-09-30T10:00:00.000Z',
    }], rowsAffected: 0 };
    if (this.failInsert && sql.includes('INSERT INTO decks')) throw new Error('disk failure');
    this.writes.push(sql);
    return { rows: [], rowsAffected: 1 };
  }

  async transaction(operation: (transaction: DatabaseTransaction) => Promise<void>): Promise<void> {
    const before = [...this.writes];
    const previous = this.cursor;
    try {
      await operation({ execute: async (sql, params) => {
        const result = await this.execute(sql, params);
        if (sql.startsWith('UPDATE sync_account SET cursor')) this.cursor = params![0] as number;
        return result;
      } });
    } catch (error) {
      this.cursor = previous;
      this.writes = before;
      throw error;
    }
  }
}

const deckPage: PullPage = {
  cursor: 1, latestVersion: 1, hasMore: false,
  changes: [{ entityType: 'deck', entityId: 'deck-one', operation: 'upsert',
    deviceId: 'device-two', clientChangeId: 'remote-one', clientChangedAtUtc: '2026-09-30T10:00:00.000Z',
    serverVersion: 1, payload: { name: 'server', description: '', language: 'en',
      textAlignment: 'ltr', typographySize: 'medium' } }],
};

test('pull commits the cursor only after local writes succeed', async () => {
  const database = new TransactionalDatabase();
  const store = new SyncStore(database);
  await store.applyPage(deckPage);
  expect(database.cursor).toBe(1);
  expect(database.writes.some((sql) => sql.includes('INSERT INTO decks'))).toBe(true);
  expect(database.writes.at(-1)).toContain('UPDATE sync_account SET cursor');
});

test('failed local application rolls back every change and keeps the original cursor', async () => {
  const database = new TransactionalDatabase();
  database.failInsert = true;
  await expect(new SyncStore(database).applyPage(deckPage)).rejects.toThrow('disk failure');
  expect(database.cursor).toBe(0);
  expect(database.writes).toEqual([]);
});

test('an offline edit becomes an explicit conflict instead of being overwritten by pull', async () => {
  const database = new TransactionalDatabase();
  database.pendingEdit = true;
  await new SyncStore(database).applyPage(deckPage);
  expect(database.cursor).toBe(1);
  expect(database.writes.some((sql) => sql.includes('INSERT INTO decks'))).toBe(false);
  expect(database.writes.some((sql) => sql.includes('INSERT INTO sync_conflicts'))).toBe(true);
});

test('archive from another device updates the tombstone rather than deleting history', async () => {
  const database = new TransactionalDatabase();
  await new SyncStore(database).applyPage({ ...deckPage,
    changes: [{ ...deckPage.changes[0]!, operation: 'archive', payload: { archivedAtUtc: '2026-09-30T10:00:00Z' } }] });
  expect(database.writes.some((sql) => sql.includes('UPDATE decks SET archived_at'))).toBe(true);
  expect(database.writes.some((sql) => sql.includes('DELETE FROM review_events'))).toBe(false);
});

test('a divergent immutable event UUID rolls back the pull cursor and preserves history', async () => {
  const database = new TransactionalDatabase();
  database.existingEvent = true;
  await expect(new SyncStore(database).applyPage({ ...deckPage,
    changes: [{ ...deckPage.changes[0]!, entityType: 'reviewEvent', entityId: 'event-one',
      operation: 'create', payload: { cardId: 'card-one', deckId: 'deck-one', previousBox: 1,
        newBox: 1, result: 'failure', reviewedAtUtc: '2026-09-30T10:00:00.000Z', studySessionId: null } }] }))
    .rejects.toThrow('Review event identity collision');
  expect(database.cursor).toBe(0);
  expect(database.writes).toEqual([]);
});
