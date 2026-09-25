import { makeEvent, makeState } from '@/../test/fixtures';
import { calendarDate, instant } from '@/core/domain/values';
import {
  analyticsWindow,
  getBoxDistribution,
  getRetentionRate,
  getStudySummary,
  validateAnalyticsRange,
} from './analytics';

const today = calendarDate('2026-09-25');
const currentInstant = instant('2026-09-25T12:00:00.000Z');
const range = analyticsWindow(today, 7);

function event(id: string, time: string, cardId = 'a', result: 'success' | 'failure' = 'success') {
  return makeEvent({ id, cardId, reviewedAt: instant(time), result });
}

test('windows include both endpoints and cross month/year boundaries', () => {
  expect(range).toEqual({ from: '2026-09-19', to: '2026-09-25' });
  expect(analyticsWindow(calendarDate('2026-01-02'), 7)).toEqual({
    from: '2025-12-27',
    to: '2026-01-02',
  });
  expect(analyticsWindow(today, 30).from).toBe('2026-08-27');
  expect(analyticsWindow(today, 90).from).toBe('2026-06-28');
  expect(() => validateAnalyticsRange({ from: today, to: calendarDate('2026-09-24') })).toThrow();
});

test('counts repeated reviews as events, unique cards once today, and zero activity days', () => {
  const events = [
    event('1', '2026-09-25T09:00:00.000Z', 'a'),
    event('2', '2026-09-25T10:00:00.000Z', 'a', 'failure'),
    event('3', '2026-09-25T11:00:00.000Z', 'b'),
    event('y', '2026-09-24T10:00:00.000Z', 'c'),
    event('gap', '2026-09-22T11:00:00.000Z', 'c'),
    event('future', '2026-09-25T13:00:00.000Z', 'd'),
    event('old', '2026-05-01T10:00:00.000Z', 'd'),
  ];
  const summary = getStudySummary(
    events,
    [makeState({ cardId: 'a', box: 2 })],
    range,
    today,
    currentInstant,
    'UTC',
  );
  expect(summary).toMatchObject({
    totalReviews: 5,
    cardsReviewedToday: 2,
    currentStreak: 2,
    bestStreak: 2,
    activeStudyDays: 3,
    retentionRate: 80,
    hasHistory: true,
    boxDistribution: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 },
  });
  expect(summary.dailyActivity).toHaveLength(7);
  expect(summary.dailyActivity[0]).toEqual({
    date: '2026-09-19',
    reviewCount: 0,
    uniqueCardsReviewed: 0,
    successfulReviews: 0,
    failedReviews: 0,
  });
  expect(summary.dailyActivity[6]).toEqual({
    date: '2026-09-25',
    reviewCount: 3,
    uniqueCardsReviewed: 2,
    successfulReviews: 2,
    failedReviews: 1,
  });
});

test('no today review resets current streak while best streak spans available history', () => {
  const events = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23'].map((day, i) =>
    event(String(i), `${day}T08:00:00.000Z`),
  );
  const summary = getStudySummary(events, [], range, today, currentInstant, 'UTC');
  expect(summary.currentStreak).toBe(0);
  expect(summary.bestStreak).toBe(4);
  expect(summary.cardsReviewedToday).toBe(0);
  expect(
    getStudySummary(
      [event('a', '2026-09-25T01:00:00.000Z')],
      [],
      range,
      today,
      currentInstant,
      'UTC',
    ).currentStreak,
  ).toBe(1);
});

test('local midnight chooses the device calendar date and excludes future events', () => {
  const summary = getStudySummary(
    [event('a', '2026-09-24T21:00:00.000Z'), event('b', '2026-09-25T12:00:01.000Z')],
    [],
    range,
    today,
    currentInstant,
    'Asia/Tehran',
  );
  expect(summary.cardsReviewedToday).toBe(1);
  expect(summary.dailyActivity.at(-1)?.reviewCount).toBe(1);
});

test('retention is null without events and exact for successes, failures, and repeats', () => {
  expect(getRetentionRate(0, 0)).toBeNull();
  expect(getRetentionRate(2, 2)).toBe(100);
  expect(getRetentionRate(0, 3)).toBe(0);
  expect(getRetentionRate(2, 3)).toBeCloseTo(66.6666667);
  const empty = getStudySummary([], [], range, today, currentInstant, 'UTC');
  expect(empty).toMatchObject({
    retentionRate: null,
    hasHistory: false,
    bestStreak: 0,
    currentStreak: 0,
  });
});

test('current box counts validate review states and do not infer missing boxes', () => {
  expect(getBoxDistribution([makeState({ box: 1 }), makeState({ cardId: 'b', box: 5 })])).toEqual({
    1: 1,
    2: 0,
    3: 0,
    4: 0,
    5: 1,
  });
  expect(() => getBoxDistribution([makeState({ box: 6 as never })])).toThrow('Leitner box');
});

test('ten thousand historical events aggregate without quadratic work or large UI output', () => {
  const events = Array.from({ length: 10_000 }, (_, i) =>
    event(
      `e${i}`,
      `2026-09-${String(25 - (i % 25)).padStart(2, '0')}T10:00:00.000Z`,
      `c${i % 100}`,
      i % 4 ? 'success' : 'failure',
    ),
  );
  const started = performance.now();
  const summary = getStudySummary(
    events,
    [],
    analyticsWindow(today, 90),
    today,
    currentInstant,
    'UTC',
  );
  expect(summary.totalReviews).toBe(10_000);
  expect(summary.cardsReviewedToday).toBe(4);
  expect(summary.retentionRate).toBe(75);
  expect(summary.dailyActivity).toHaveLength(90);
  expect(summary.bestStreak).toBe(25);
  expect(performance.now() - started).toBeLessThan(8_000);
});
