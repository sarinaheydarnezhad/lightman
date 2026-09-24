import { makeState } from '@/../test/fixtures';
import { calendarDate, instant } from '@/core/domain/values';
import { calculateReviewTransition } from '../leitner-srs';

const date = calendarDate('2026-09-24');
const at = instant('2026-09-24T18:45:12.000Z');

test.each([
  [1, 2, 2, '2026-09-26'],
  [2, 3, 4, '2026-09-28'],
  [3, 4, 8, '2026-10-02'],
  [4, 5, 16, '2026-10-10'],
  [5, 5, 16, '2026-10-10'],
] as const)(
  'successful review moves Box %i to Box %i and schedules %i calendar days',
  (box, newBox, intervalDays, dueDate) => {
    const previousDueDate = calendarDate('2026-09-01');
    const transition = calculateReviewTransition(
      makeState({ box, dueDate: previousDueDate }),
      'success',
      date,
      at,
    );
    expect(transition).toMatchObject({
      previousBox: box,
      newBox,
      intervalDays,
      result: 'success',
      previousDueDate,
      newDueDate: calendarDate(dueDate),
    });
    expect(transition.updatedReviewState).toMatchObject({
      box: newBox,
      dueDate: calendarDate(dueDate),
      lastReviewedAt: at,
      updatedAt: at,
      totalReviews: 1,
      totalSuccesses: 1,
      consecutiveSuccesses: 1,
    });
  },
);

test.each([1, 2, 3, 4, 5] as const)(
  'failed review from Box %i resets to Box 1, due on the same day',
  (box) => {
    const transition = calculateReviewTransition(
      makeState({ box, totalReviews: 4, totalSuccesses: 3, consecutiveSuccesses: 2 }),
      'failure',
      date,
      at,
    );
    expect(transition).toMatchObject({
      previousBox: box,
      newBox: 1,
      result: 'failure',
      intervalDays: 0,
      newDueDate: date,
    });
    expect(transition.updatedReviewState).toMatchObject({
      box: 1,
      dueDate: date,
      lastReviewedAt: at,
      updatedAt: at,
      totalReviews: 5,
      totalSuccesses: 3,
      consecutiveSuccesses: 0,
    });
  },
);

test('Box 5 success cannot create Box 6, and Box 1 failure cannot create Box 0', () => {
  expect(calculateReviewTransition(makeState({ box: 5 }), 'success', date, at).newBox).toBe(5);
  expect(calculateReviewTransition(makeState({ box: 1 }), 'failure', date, at).newBox).toBe(1);
});
