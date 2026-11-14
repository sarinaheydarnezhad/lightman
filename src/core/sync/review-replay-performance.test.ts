import { RealSqliteDatabase } from '@/../test/real-sqlite';
import {
  checkpointFor,
  ReplayMetricsDatabase,
  reviewChanges,
  reviewPages,
  seedReplayDatabase,
} from '@/../test/review-replay-fixture';
import { SyncStore } from './sync-store';
import * as replay from './review-merge';

afterEach(() => jest.restoreAllMocks());

test('F10: 200 reviews in two legal pages replay once per card per page', async () => {
  const db = await RealSqliteDatabase.open();
  try {
    await seedReplayDatabase(db);
    const observed = new ReplayMetricsDatabase(db);
    const store = new SyncStore(observed);
    const merge = jest.spyOn(replay, 'mergeReviewEvents');
    for (const page of reviewPages(reviewChanges(200))) await store.applyPage(page);
    expect(merge).toHaveBeenCalledTimes(2);
    expect(observed.historyQueries).toBe(2);
    // No synthetic optimization checkpoint: growing histories still require 100 + 200 rows.
    expect(observed.historyRows).toBe(300);
    expect(observed.projectionWrites).toBe(2);
    expect(observed.insertedEvents).toBe(200);
    expect(observed.transactions).toBe(2);
  } finally {
    db.handle.close();
  }
});

test.each(['leitner', 'sm2'])(
  'checkpoint-backed %s pages never replay covered history',
  async (scheduler) => {
    const db = await RealSqliteDatabase.open();
    try {
      await seedReplayDatabase(db, scheduler);
      const observed = new ReplayMetricsDatabase(db);
      const changes = reviewChanges(200);
      const checkpoint = checkpointFor(changes, 'card-0', scheduler, 200);
      const store = new SyncStore(observed);
      for (const page of reviewPages(changes))
        await store.applyPage({ ...page, reviewCheckpoints: [checkpoint] });
      expect(observed.historyQueries).toBe(2);
      expect(observed.historyRows).toBe(0);
      expect(observed.projectionWrites).toBe(2);
      expect(observed.insertedEvents).toBe(200);
    } finally {
      db.handle.close();
    }
  },
);

test.each([1, 5, 20, 100])(
  'history work scales with %i affected cards, not events or unrelated cards',
  async (cards) => {
    const db = await RealSqliteDatabase.open();
    try {
      await seedReplayDatabase(db, 'leitner', 101);
      const observed = new ReplayMetricsDatabase(db);
      const store = new SyncStore(observed);
      await store.applyPage(reviewPages(reviewChanges(100, cards))[0]!);
      expect(observed.historyQueries).toBe(cards);
      expect(observed.historyRows).toBe(100);
      expect(observed.projectionWrites).toBe(cards);
      expect(
        (await db.execute("SELECT total_reviews FROM card_review_state WHERE card_id='card-100'"))
          .rows[0]!.total_reviews,
      ).toBe(0);
    } finally {
      db.handle.close();
    }
  },
);
