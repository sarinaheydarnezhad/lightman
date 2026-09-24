import { calendarDate, instant } from '@/core/domain/values';
import { createInitialReviewState, isCardDue } from '../leitner-srs';

const date = calendarDate('2026-09-24');
const at = instant('2026-09-24T18:45:12.000Z');

test('a new card starts due on its supplied review day without any review history', () => {
  const state = createInitialReviewState('card-1', date, at);
  expect(state).toEqual({
    cardId: 'card-1',
    box: 1,
    dueDate: date,
    lastReviewedAt: null,
    consecutiveSuccesses: 0,
    totalReviews: 0,
    totalSuccesses: 0,
    updatedAt: at,
  });
  expect(isCardDue(state.dueDate, date)).toBe(true);
});

test('initialization with identical explicit inputs is deterministic and creates independent state objects', () => {
  const first = createInitialReviewState('card-1', date, at);
  const second = createInitialReviewState('card-1', date, at);
  expect(second).toEqual(first);
  expect(second).not.toBe(first);
});

test('initial state uses the supplied calendar date, independent of instant UTC date and wall clock', () => {
  const lateInstant = instant('2026-09-24T23:45:12.000Z');
  const localDate = calendarDate('2026-09-25');
  expect(createInitialReviewState('card-1', localDate, lateInstant)).toMatchObject({
    dueDate: localDate,
    updatedAt: lateInstant,
    lastReviewedAt: null,
  });
});
