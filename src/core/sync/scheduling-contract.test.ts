import { calendarDate, instant } from '@/core/domain/values';
import { createReviewEngine } from '@/features/study/domain/review-engine-impl';
import { mergeReviewEvents } from './review-merge';
import { makeCard, makeDeck, fixedClock, sequenceIds } from '@/../test/fixtures';
import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { runMigrations } from '@/core/database/migrations';
import { createApplication } from '@/core/application/create-application';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';

describe.each(['leitner', 'sm2'])('scheduling contract: %s', (schedulerId) => {
  const scheduler = createReviewEngine().getScheduler(schedulerId);
  const time = instant('2026-11-12T21:30:00.000Z');
  test('F01 preserves the original Tehran review day after replay', () => {
    const event = {
      id: 'event',
      reviewedAt: time,
      result: 'success' as const,
      reviewCalendar: { reviewDate: calendarDate('2026-11-13'), utcOffsetMinutes: 210 },
    };
    const local = scheduler.processReview(
      scheduler.createInitialState('card', calendarDate('2026-11-13'), time),
      'success',
      calendarDate('2026-11-13'),
      time,
    ).updatedReviewState;
    expect(mergeReviewEvents('card', time, [event], scheduler).dueDate).toBe(local.dueDate);
  });
  test('F03 preserves the accepted baseline and counts only subsequent events', () => {
    const initial = scheduler.createInitialState('card', calendarDate('2026-11-12'), time);
    const state = {
      ...initial,
      ...(schedulerId === 'leitner'
        ? { box: 4 as const }
        : {
            schedulerState: {
              schedulerId: 'sm2',
              key: 'review',
              data: { repetitions: 3, intervalDays: 16, easeFactor: 2.8 },
            },
          }),
      totalReviews: 9,
      totalSuccesses: 8,
      consecutiveSuccesses: 3,
    };
    const event = { id: 'next', serverVersion: 8, reviewedAt: time, result: 'success' as const };
    const baseline = { state, throughVersion: 7, includedEventIds: [] };
    expect(mergeReviewEvents('card', time, [event], scheduler, baseline).totalReviews).toBe(10);
    expect(mergeReviewEvents('card', time, [event, event], scheduler, baseline).totalReviews).toBe(
      10,
    );
    if (schedulerId === 'leitner')
      expect(mergeReviewEvents('card', time, [event], scheduler, baseline).box).toBe(5);
    const second = { ...event, id: 'second', serverVersion: 9, result: 'failure' as const };
    for (let replay = 0; replay < 2; replay++) {
      expect(
        mergeReviewEvents('card', time, [second, event, event], scheduler, baseline),
      ).toMatchObject({
        totalReviews: 11,
        totalSuccesses: 9,
        consecutiveSuccesses: 0,
      });
    }
  });
  test('F11 a valid review after clock correction can recover future-pinned progress', () => {
    const future = instant('2076-11-13T08:00:00.000Z');
    const initial = scheduler.createInitialState('card', calendarDate('2076-11-13'), future);
    const state = scheduler.processReview(
      initial,
      'success',
      calendarDate('2076-11-13'),
      future,
    ).updatedReviewState;
    const corrected = instant('2026-11-13T08:00:00.000Z');
    const next = scheduler.processReview(
      state,
      'failure',
      calendarDate('2026-11-13'),
      corrected,
    ).updatedReviewState;
    expect(next.lastReviewedAt).toBe(corrected);
    expect(next.dueDate).toBe(schedulerId === 'leitner' ? '2026-11-13' : '2026-11-14');
    expect(next.totalReviews).toBe(2);
  });
  test('a checkpoint with no new events is unchanged; covered IDs cannot be counted again', () => {
    const state = {
      ...scheduler.createInitialState('card', calendarDate('2026-11-12'), time),
      totalReviews: 9,
      totalSuccesses: 8,
      consecutiveSuccesses: 3,
    };
    const baseline = { state, throughVersion: 7, includedEventIds: ['covered'] };
    expect(mergeReviewEvents('card', time, [], scheduler, baseline)).toEqual(state);
    expect(
      mergeReviewEvents(
        'card',
        time,
        [{ id: 'covered', serverVersion: 9, reviewedAt: time, result: 'success' }],
        scheduler,
        baseline,
      ).totalReviews,
    ).toBe(9);
    expect(state.totalReviews).toBe(9);
  });
  test('server versions, rather than arrival order or device timestamps, determine replay order', () => {
    const events = [
      {
        id: 'second',
        serverVersion: 2,
        reviewedAt: instant('2026-11-12T10:00:00.000Z'),
        result: 'failure' as const,
      },
      {
        id: 'first',
        serverVersion: 1,
        reviewedAt: instant('2026-11-13T10:00:00.000Z'),
        result: 'success' as const,
      },
    ];
    const result = mergeReviewEvents('card', time, events, scheduler);
    expect(result.totalReviews).toBe(2);
    expect(result.totalSuccesses).toBe(1);
    expect(result.lastReviewedAt).toBe(events[0]!.reviewedAt);
    expect(result.dueDate).toBe(schedulerId === 'leitner' ? '2026-11-12' : '2026-11-13');
  });
});

test('F05 an archived card still makes a scheduler change ineligible', async () => {
  const db = await RealSqliteDatabase.open();
  try {
    await runMigrations(db);
    const app = createApplication(createSqliteRepositories(db), fixedClock, sequenceIds());
    const deck = await app.createDeck(makeDeck());
    const card = await app.createCard({ ...makeCard(), deckId: deck.id });
    await app.archiveCard(card.id);
    await expect(app.updateDeck(deck.id, { reviewSystem: 'sm2' })).rejects.toMatchObject({
      code: 'conflict',
    });
    expect((await app.getDeck(deck.id)).reviewSystem).toBe('leitner');
  } finally {
    db.handle.close();
  }
});
