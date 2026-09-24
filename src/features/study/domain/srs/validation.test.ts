import { makeState } from '@/../test/fixtures';
import { calendarDate, instant } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import {
  calculateReviewTransition,
  createInitialReviewState,
  createReviewEvent,
  getDueReviewStates,
  isCardDue,
} from '../leitner-srs';
import type { LeitnerBox, ReviewResult } from '../review';

const day = calendarDate('2026-09-24');
const at = instant('2026-09-24T18:45:12.000Z');

test.each([0, 6, -1, 1.5, NaN, Infinity])(
  'transition rejects invalid saved box %s before calculating',
  (box) => {
    expect(() =>
      calculateReviewTransition(makeState({ box: box as LeitnerBox }), 'success', day, at),
    ).toThrow(AppError);
  },
);

test.each(['again', '', null, undefined, 1])(
  'transition rejects non-domain review result %s',
  (result) => {
    expect(() => calculateReviewTransition(makeState(), result as ReviewResult, day, at)).toThrow(
      'Invalid review result.',
    );
  },
);

test('initialization and transitions reject missing card IDs and malformed calendar dates', () => {
  expect(() => createInitialReviewState('', day, at)).toThrow('Card ID is required.');
  expect(() => createInitialReviewState('card-1', '2026-02-30' as never, at)).toThrow(AppError);
  expect(() => calculateReviewTransition(makeState({ cardId: '  ' }), 'success', day, at)).toThrow(
    AppError,
  );
  expect(() =>
    calculateReviewTransition(makeState(), 'success', '2026-13-01' as never, at),
  ).toThrow(AppError);
  expect(() =>
    calculateReviewTransition(makeState({ dueDate: '2026-02-30' as never }), 'success', day, at),
  ).toThrow(AppError);
  expect(() => isCardDue('2026-02-30' as never, day)).toThrow(AppError);
  expect(() => getDueReviewStates([makeState({ dueDate: '2026-02-30' as never })], day)).toThrow(
    AppError,
  );
});

test.each([
  { totalReviews: -1 },
  { totalSuccesses: -1 },
  { consecutiveSuccesses: -1 },
  { totalReviews: 1, totalSuccesses: 2 },
  { totalReviews: 1, totalSuccesses: 1, consecutiveSuccesses: 2 },
  { totalReviews: 1.5 },
] as const)('transition refuses inconsistent or negative counters: %j', (changes) => {
  expect(() => calculateReviewTransition(makeState(changes), 'success', day, at)).toThrow(AppError);
});

test('review time cannot precede the saved state and counter overflow cannot enter state', () => {
  expect(() =>
    calculateReviewTransition(makeState(), 'success', day, instant('2026-09-23T00:00:00.000Z')),
  ).toThrow('Review time cannot precede the saved review state.');
  const safe = Number.MAX_SAFE_INTEGER;
  expect(
    calculateReviewTransition(
      makeState({
        totalReviews: safe - 1,
        totalSuccesses: safe - 1,
        consecutiveSuccesses: safe - 1,
      }),
      'success',
      day,
      at,
    ).updatedReviewState.totalReviews,
  ).toBe(safe);
  expect(() =>
    calculateReviewTransition(
      makeState({ totalReviews: safe, totalSuccesses: safe }),
      'success',
      day,
      at,
    ),
  ).toThrow(AppError);
  expect(() =>
    calculateReviewTransition(
      makeState({ totalReviews: safe, totalSuccesses: safe, consecutiveSuccesses: safe }),
      'failure',
      day,
      at,
    ),
  ).toThrow(AppError);
});

test('event creation rejects missing deck ID or card ID and mismatched review facts', () => {
  const transition = calculateReviewTransition(makeState(), 'success', day, at);
  const input = {
    id: 'event-1',
    cardId: 'card-1',
    deckId: 'deck-1',
    reviewedAt: at,
    studySessionId: null,
  };
  expect(() => createReviewEvent(transition, { ...input, cardId: '' })).toThrow(AppError);
  expect(() => createReviewEvent(transition, { ...input, deckId: '' })).toThrow(AppError);
  expect(() =>
    createReviewEvent(transition, { ...input, reviewedAt: instant('2026-09-24T18:45:13.000Z') }),
  ).toThrow(AppError);
  expect(() => createReviewEvent({ ...transition, newBox: 3 }, input)).toThrow(AppError);
  expect(() =>
    createReviewEvent({ ...transition, newDueDate: calendarDate('2026-10-10') }, input),
  ).toThrow(AppError);
});
