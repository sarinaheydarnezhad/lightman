import { AppError } from '@/core/errors/app-error';
import { makeEvent, makeState } from '@/../test/fixtures';
import { leitnerBox, validateReviewEvent, validateReviewState } from './review';

test('Leitner boxes accept only integer values 1 through 5', () => {
  expect([1, 2, 3, 4, 5].map(leitnerBox)).toEqual([1, 2, 3, 4, 5]);
  for (const value of [-1, 0, 1.5, 6, NaN]) expect(() => leitnerBox(value)).toThrow(AppError);
});

test('review state enforces valid counts, identifiers, and calendar dates', () => {
  expect(validateReviewState(makeState({ box: 5 })).box).toBe(5);
  expect(() => validateReviewState(makeState({ box: 6 as never }))).toThrow(AppError);
  expect(() => validateReviewState(makeState({ totalReviews: -1 }))).toThrow(AppError);
  expect(() => validateReviewState(makeState({ totalSuccesses: 1 }))).toThrow(AppError);
  expect(() => validateReviewState(makeState({ dueDate: '2026-02-30' as never }))).toThrow(
    AppError,
  );
});

test('review event copies and freezes historical facts', () => {
  const input = makeEvent();
  const event = validateReviewEvent(input);
  expect(Object.isFrozen(event)).toBe(true);
  expect(event).not.toBe(input);
  expect(() => validateReviewEvent(makeEvent({ cardId: '' }))).toThrow(AppError);
  expect(() => validateReviewEvent(makeEvent({ result: 'maybe' as never }))).toThrow(AppError);
});
