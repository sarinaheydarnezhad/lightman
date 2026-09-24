import { makeState } from '@/../test/fixtures';
import { calendarDate, instant } from '@/core/domain/values';
import { calculateReviewTransition, isCardDue } from '../leitner-srs';

const today = calendarDate('2026-09-24');
const reviewedAt = instant('2026-09-24T18:45:12.000Z');

test('four-day-overdue card remains due and keeps its box until a review is submitted', () => {
  const state = makeState({ box: 4, dueDate: calendarDate('2026-09-20') });
  expect(isCardDue(state.dueDate, today)).toBe(true);
  expect(state.box).toBe(4);
  expect(calculateReviewTransition(state, 'success', today, reviewedAt)).toMatchObject({
    previousBox: 4,
    newBox: 5,
    intervalDays: 16,
    newDueDate: '2026-10-10',
  });
  expect(calculateReviewTransition(state, 'failure', today, reviewedAt)).toMatchObject({
    previousBox: 4,
    newBox: 1,
    intervalDays: 0,
    newDueDate: today,
  });
  expect(state.box).toBe(4);
});

test('even a years-overdue card receives the ordinary transition with no extra penalty', () => {
  const old = makeState({ box: 3, dueDate: calendarDate('2001-01-01') });
  expect(isCardDue(old.dueDate, today)).toBe(true);
  expect(calculateReviewTransition(old, 'success', today, reviewedAt)).toMatchObject({
    newBox: 4,
    newDueDate: '2026-10-02',
  });
  expect(calculateReviewTransition(old, 'failure', today, reviewedAt)).toMatchObject({
    newBox: 1,
    newDueDate: today,
  });
});
