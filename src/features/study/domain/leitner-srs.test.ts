import { calendarDate, instant } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import { makeState } from '@/../test/fixtures';
import {
  calculateReviewTransition,
  createInitialReviewState,
  createReviewEvent,
  getDueReviewStates,
  getIntervalDays,
  isCardDue,
} from './leitner-srs';
import type { LeitnerBox, ReviewResult } from './review';

const day = calendarDate('2026-09-24');
const reviewedAt = instant('2026-09-24T18:45:12.000Z');

test('initial card is due today in Box 1 and has never been reviewed', () => {
  const initial = createInitialReviewState('card-1', day, reviewedAt);
  expect(initial).toEqual({
    cardId: 'card-1',
    box: 1,
    dueDate: day,
    lastReviewedAt: null,
    consecutiveSuccesses: 0,
    totalReviews: 0,
    totalSuccesses: 0,
    updatedAt: reviewedAt,
  });
  expect(() => createInitialReviewState('', day, reviewedAt)).toThrow(AppError);
});

test.each([
  [1, 1],
  [2, 2],
  [3, 4],
  [4, 8],
  [5, 16],
] as const)('Box %i has a %i-calendar-day interval', (box, days) => {
  expect(getIntervalDays(box)).toBe(days);
});

test.each([
  [1, 2, 2, '2026-09-26'],
  [2, 3, 4, '2026-09-28'],
  [3, 4, 8, '2026-10-02'],
  [4, 5, 16, '2026-10-10'],
  [5, 5, 16, '2026-10-10'],
] as const)('Box %i success enters Box %i and schedules %i days', (box, next, days, due) => {
  const before = Object.freeze(
    makeState({
      box,
      dueDate: calendarDate('2026-09-01'),
      totalReviews: 4,
      totalSuccesses: 3,
      consecutiveSuccesses: 2,
    }),
  );
  const transition = calculateReviewTransition(before, 'success', day, reviewedAt);
  expect(transition).toMatchObject({
    previousBox: box,
    newBox: next,
    result: 'success',
    intervalDays: days,
    previousDueDate: calendarDate('2026-09-01'),
    newDueDate: calendarDate(due),
  });
  expect(transition.updatedReviewState).toMatchObject({
    box: next,
    dueDate: calendarDate(due),
    totalReviews: 5,
    totalSuccesses: 4,
    consecutiveSuccesses: 3,
    lastReviewedAt: reviewedAt,
    updatedAt: reviewedAt,
  });
  expect(before.box).toBe(box);
  expect(before.totalReviews).toBe(4);
  expect(transition.updatedReviewState).not.toBe(before);
});

test.each([1, 2, 3, 4, 5] as const)('Box %i failure resets to Box 1 due immediately', (box) => {
  const transition = calculateReviewTransition(
    makeState({ box, totalReviews: 4, totalSuccesses: 3, consecutiveSuccesses: 2 }),
    'failure',
    day,
    reviewedAt,
  );
  expect(transition).toMatchObject({ newBox: 1, intervalDays: 0, newDueDate: day });
  expect(transition.updatedReviewState).toMatchObject({
    totalReviews: 5,
    totalSuccesses: 3,
    consecutiveSuccesses: 0,
    lastReviewedAt: reviewedAt,
  });
});

test('a same-day failure after success is immediately due; subsequent success starts a new streak', () => {
  const first = calculateReviewTransition(makeState(), 'success', day, reviewedAt);
  const failed = calculateReviewTransition(first.updatedReviewState, 'failure', day, reviewedAt);
  expect(failed.updatedReviewState).toMatchObject({
    box: 1,
    dueDate: day,
    consecutiveSuccesses: 0,
  });
  expect(
    calculateReviewTransition(failed.updatedReviewState, 'success', day, reviewedAt)
      .updatedReviewState,
  ).toMatchObject({
    box: 2,
    consecutiveSuccesses: 1,
    totalReviews: 3,
    totalSuccesses: 2,
  });
});

test('overdue cards keep their box until reviewed, including very old due dates', () => {
  const old = makeState({ box: 4, dueDate: calendarDate('2001-01-01') });
  expect(isCardDue(old.dueDate, day)).toBe(true);
  expect(old.box).toBe(4);
  expect(calculateReviewTransition(old, 'success', day, reviewedAt).newDueDate).toBe('2026-10-10');
  expect(calculateReviewTransition(old, 'failure', day, reviewedAt).newDueDate).toBe(day);
});

test('due comparisons and queue use date only, preserve input, and break ties deterministically', () => {
  expect(isCardDue(calendarDate('2026-09-23'), day)).toBe(true);
  expect(isCardDue(day, day)).toBe(true);
  expect(isCardDue(calendarDate('2026-09-25'), day)).toBe(false);
  const states = Object.freeze([
    makeState({ cardId: 'z', box: 2 }),
    makeState({ cardId: 'future', dueDate: calendarDate('2026-09-25') }),
    makeState({ cardId: 'b', box: 1 }),
    makeState({ cardId: 'a', box: 1 }),
    makeState({ cardId: 'old', box: 5, dueDate: calendarDate('2026-09-20') }),
  ]);
  expect(getDueReviewStates(states, day).map((state) => state.cardId)).toEqual([
    'old',
    'a',
    'b',
    'z',
  ]);
  expect(states[0]?.cardId).toBe('z');
  expect(() => isCardDue('2026-02-30' as never, day)).toThrow(AppError);
});

test('custom interval policy is replaceable without changing promotion or failure rules', () => {
  const policy = { getIntervalDays: (box: LeitnerBox) => box * 3 };
  const success = calculateReviewTransition(makeState(), 'success', day, reviewedAt, policy);
  expect(success).toMatchObject({ newBox: 2, intervalDays: 6, newDueDate: '2026-09-30' });
  const failure = calculateReviewTransition(makeState(), 'failure', day, reviewedAt, policy);
  expect(failure.intervalDays).toBe(0);
  expect(() => getIntervalDays(1, { getIntervalDays: () => 0 })).toThrow(AppError);
});

test('review event records validated transition facts without mutating the state', () => {
  const transition = calculateReviewTransition(makeState(), 'success', day, reviewedAt);
  const event = createReviewEvent(transition, {
    id: 'event-1',
    cardId: 'card-1',
    deckId: 'deck-1',
    reviewedAt,
    studySessionId: null,
  });
  expect(event).toMatchObject({ previousBox: 1, newBox: 2, result: 'success' });
  expect(Object.isFrozen(event)).toBe(true);
  expect(() =>
    createReviewEvent(transition, {
      ...event,
      cardId: 'another-card',
    }),
  ).toThrow(AppError);
});

test('rejects invalid runtime boxes/results/dates, stale instants, and unsafe counter increments', () => {
  for (const box of [0, 6, -1, 1.5, NaN, Infinity, -Infinity]) {
    expect(() => getIntervalDays(box as LeitnerBox)).toThrow(AppError);
    expect(() =>
      calculateReviewTransition(makeState({ box: box as LeitnerBox }), 'success', day, reviewedAt),
    ).toThrow(AppError);
  }
  for (const result of ['maybe', null, undefined]) {
    expect(() =>
      calculateReviewTransition(makeState(), result as ReviewResult, day, reviewedAt),
    ).toThrow(AppError);
  }
  expect(() =>
    calculateReviewTransition(makeState(), 'success', '2026-02-30' as never, reviewedAt),
  ).toThrow(AppError);
  expect(() =>
    calculateReviewTransition(makeState(), 'success', day, instant('2026-09-23T00:00:00.000Z')),
  ).toThrow(AppError);
  const safe = Number.MAX_SAFE_INTEGER;
  const large = makeState({
    totalReviews: safe - 1,
    totalSuccesses: safe - 1,
    consecutiveSuccesses: safe - 1,
  });
  expect(
    calculateReviewTransition(large, 'success', day, reviewedAt).updatedReviewState.totalReviews,
  ).toBe(safe);
  expect(() =>
    calculateReviewTransition(
      makeState({ totalReviews: safe, totalSuccesses: safe }),
      'success',
      day,
      reviewedAt,
    ),
  ).toThrow(AppError);
  expect(() =>
    calculateReviewTransition(
      makeState({ totalReviews: safe, totalSuccesses: safe, consecutiveSuccesses: safe }),
      'failure',
      day,
      reviewedAt,
    ),
  ).toThrow(AppError);
});

test('transitions preserve review invariants across all boxes and both results', () => {
  for (const box of [1, 2, 3, 4, 5] as const) {
    for (const result of ['success', 'failure'] as const) {
      const transition = calculateReviewTransition(makeState({ box }), result, day, reviewedAt);
      const state = transition.updatedReviewState;
      expect(state.box).toBeGreaterThanOrEqual(1);
      expect(state.box).toBeLessThanOrEqual(5);
      expect(state.totalReviews).toBeGreaterThanOrEqual(0);
      expect(state.totalSuccesses).toBeGreaterThanOrEqual(0);
      expect(state.totalSuccesses).toBeLessThanOrEqual(state.totalReviews);
      expect(state.consecutiveSuccesses).toBeGreaterThanOrEqual(0);
      expect(state.consecutiveSuccesses).toBeLessThanOrEqual(state.totalReviews);
      expect(state.dueDate).toBeDefined();
      if (result === 'success') expect(state.box).toBeGreaterThanOrEqual(box);
      else expect(state.box).toBe(1);
    }
  }
});
