import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { makeCard, makeDeck } from '@/../test/fixtures';
import { migrations, runMigrations } from '@/core/database/migrations';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { createApplication } from '@/core/application/create-application';
import { SyncStore } from './sync-store';

test('upgrade recovers rejected SM-2 operations and preserves immutable history and local progress', async () => {
  const database = await RealSqliteDatabase.open();
  for (const migration of migrations.filter((item) => item.version <= 6)) {
    await database.transaction(async (transaction) => {
      for (const sql of migration.statements) await transaction.execute(sql);
      await transaction.execute(`PRAGMA user_version = ${migration.version}`);
    });
  }
  let sequence = 0;
  const app = createApplication(
    createSqliteRepositories(database),
    {
      now: () => new Date('2026-11-02T12:00:00Z'),
      timeZone: () => 'UTC',
    },
    { create: () => 'id-' + ++sequence },
  );
  const deck = await app.createDeck(makeDeck({ reviewSystem: 'sm2' }));
  const card = await app.createCard({ ...makeCard(), deckId: deck.id });
  await app.reviewCard({
    cardId: card.id,
    deckId: deck.id,
    result: 'success',
    studySessionId: null,
  });
  const originalState = await app.getReviewState(card.id);
  const originalEvents = (await database.execute('SELECT * FROM review_events')).rows;
  await database.execute("UPDATE sync_operations SET status = 'failed', retry_count = 1");
  await runMigrations(database);
  const store = new SyncStore(database);
  const operations = await store.pending();
  expect(operations).toHaveLength(4);
  expect(await store.counts()).toEqual({ pending: 4, failed: 0, conflict: 0 });
  expect(operations.find((item) => item.entityType === 'reviewState')!.payload).toMatchObject({
    totalReviews: 0,
    schedulerState: {
      schedulerId: 'sm2',
      key: 'new',
      data: { repetitions: 0, intervalDays: 0, easeFactor: 2.5 },
    },
  });
  expect(operations.find((item) => item.entityType === 'reviewEvent')!.payload).toMatchObject({
    scheduler: { schedulerId: 'sm2', previousState: 'new', newState: 'learning' },
  });
  expect(await app.getReviewState(card.id)).toEqual(originalState);
  expect((await database.execute('SELECT * FROM review_events')).rows).toEqual(originalEvents);
  await runMigrations(database);
  expect(await store.pending()).toEqual(operations);
});
