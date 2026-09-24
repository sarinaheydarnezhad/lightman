import { makeState } from '@/../test/fixtures';
import { calendarDate, instant } from '@/core/domain/values';
import { calculateReviewTransition, createInitialReviewState } from '../leitner-srs';
import type { CardReviewState, ReviewResult } from '../review';

const date = calendarDate('2026-09-24');
const at = instant('2026-09-24T18:45:12.000Z');

test('success, success, success, failure, success advances independent review counters', () => {
  let state: CardReviewState = createInitialReviewState('card-1', date, at);
  const expected = [
    ['success', 2, 1, 1, 1],
    ['success', 3, 2, 2, 2],
    ['success', 4, 3, 3, 3],
    ['failure', 1, 4, 3, 0],
    ['success', 2, 5, 4, 1],
  ] as const;
  for (const [result, box, totalReviews, totalSuccesses, consecutiveSuccesses] of expected) {
    state = calculateReviewTransition(state, result, date, at).updatedReviewState;
    expect(state).toMatchObject({ box, totalReviews, totalSuccesses, consecutiveSuccesses });
  }
});

test('Box 5 and twelve consecutive successes are distinct values through failure and success', () => {
  const state = makeState({
    box: 5,
    totalReviews: 15,
    totalSuccesses: 12,
    consecutiveSuccesses: 12,
  });
  const failed = calculateReviewTransition(state, 'failure', date, at).updatedReviewState;
  expect(failed).toMatchObject({
    box: 1,
    totalReviews: 16,
    totalSuccesses: 12,
    consecutiveSuccesses: 0,
  });
  expect(calculateReviewTransition(failed, 'success', date, at).updatedReviewState).toMatchObject({
    box: 2,
    totalReviews: 17,
    totalSuccesses: 13,
    consecutiveSuccesses: 1,
  });
});

test.each([
  ['success', 10001, 9001, 51, 4],
  ['failure', 10001, 9000, 0, 1],
] as const)(
  'reviewing realistic large counters with %s preserves exact arithmetic',
  (result, reviews, successes, streak, box) => {
    const state = makeState({
      box: 3,
      totalReviews: 10000,
      totalSuccesses: 9000,
      consecutiveSuccesses: 50,
    });
    expect(calculateReviewTransition(state, result, date, at).updatedReviewState).toMatchObject({
      box,
      totalReviews: reviews,
      totalSuccesses: successes,
      consecutiveSuccesses: streak,
    });
    expect(state.totalReviews).toBe(10000);
  },
);

test('a realistic eight-review sequence has the right complete state at every step', () => {
  const start = createInitialReviewState('card-1', date, at);
  const expected: readonly [ReviewResult, number, string, number, number, number][] = [
    ['success', 2, '2026-09-26', 1, 1, 1],
    ['success', 3, '2026-09-28', 2, 2, 2],
    ['failure', 1, '2026-09-24', 3, 2, 0],
    ['success', 2, '2026-09-26', 4, 3, 1],
    ['success', 3, '2026-09-28', 5, 4, 2],
    ['failure', 1, '2026-09-24', 6, 4, 0],
    ['success', 2, '2026-09-26', 7, 5, 1],
    ['success', 3, '2026-09-28', 8, 6, 2],
  ];
  let state = start;
  for (const [
    result,
    box,
    dueDate,
    totalReviews,
    totalSuccesses,
    consecutiveSuccesses,
  ] of expected) {
    state = calculateReviewTransition(state, result, date, at).updatedReviewState;
    expect(state).toEqual({
      cardId: 'card-1',
      box,
      dueDate,
      lastReviewedAt: at,
      updatedAt: at,
      totalReviews,
      totalSuccesses,
      consecutiveSuccesses,
    });
  }
  expect(start.totalReviews).toBe(0);
});

test('all box/result pairs preserve counter bounds and do not confuse box with streak', () => {
  for (const box of [1, 2, 3, 4, 5] as const) {
    for (const result of ['success', 'failure'] as const) {
      const previous = makeState({
        box,
        totalReviews: 100,
        totalSuccesses: 70,
        consecutiveSuccesses: 10,
      });
      const state = calculateReviewTransition(previous, result, date, at).updatedReviewState;
      expect(state.box).toBeGreaterThanOrEqual(1);
      expect(state.box).toBeLessThanOrEqual(5);
      expect(state.totalReviews).toBeGreaterThanOrEqual(0);
      expect(state.totalSuccesses).toBeGreaterThanOrEqual(0);
      expect(state.totalSuccesses).toBeLessThanOrEqual(state.totalReviews);
      expect(state.consecutiveSuccesses).toBeGreaterThanOrEqual(0);
      expect(state.consecutiveSuccesses).toBeLessThanOrEqual(state.totalReviews);
      expect(state.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (result === 'success') {
        expect(state.box).toBeGreaterThanOrEqual(box);
        expect(state.consecutiveSuccesses).toBe(previous.consecutiveSuccesses + 1);
      } else {
        expect(state.box).toBe(1);
        expect(state.consecutiveSuccesses).toBe(0);
      }
    }
  }
});
