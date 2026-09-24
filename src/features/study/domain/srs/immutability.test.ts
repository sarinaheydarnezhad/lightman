import { makeState } from '@/../test/fixtures';
import { calendarDate, instant } from '@/core/domain/values';
import {
  calculateReviewTransition,
  createInitialReviewState,
  createReviewEvent,
  getDueReviewStates,
} from '../leitner-srs';

const date = calendarDate('2026-09-24');
const at = instant('2026-09-24T18:45:12.000Z');

test.each([1, 2, 3, 4, 5] as const)(
  'success and failure from Box %i never change the caller-owned review state',
  (box) => {
    for (const result of ['success', 'failure'] as const) {
      const input = Object.freeze(
        makeState({
          box,
          totalReviews: 4,
          totalSuccesses: 3,
          consecutiveSuccesses: 2,
          dueDate: calendarDate('2026-09-20'),
        }),
      );
      const snapshot = JSON.stringify(input);
      const transition = calculateReviewTransition(input, result, date, at);
      expect(JSON.stringify(input)).toBe(snapshot);
      expect(transition.updatedReviewState).not.toBe(input);
      expect(transition.updatedReviewState.cardId).toBe(input.cardId);
      expect(transition.previousDueDate).toBe(input.dueDate);
    }
  },
);

test('identical explicit inputs and policy always produce identical transitions', () => {
  const state = Object.freeze(
    makeState({ box: 4, totalReviews: 5, totalSuccesses: 4, consecutiveSuccesses: 2 }),
  );
  const policy = { getIntervalDays: () => 9 };
  const first = calculateReviewTransition(state, 'success', date, at, policy);
  for (let i = 0; i < 10; i++) {
    const next = calculateReviewTransition(state, 'success', date, at, policy);
    expect(next).toEqual(first);
    expect(JSON.stringify(next)).toBe(JSON.stringify(first));
    expect(next).not.toBe(first);
    expect(next.updatedReviewState).not.toBe(first.updatedReviewState);
  }
});

test('a review creates one frozen event with the supplied ID and all historical facts', () => {
  const transition = calculateReviewTransition(makeState({ box: 3 }), 'success', date, at);
  const event = createReviewEvent(transition, {
    id: 'event-1',
    cardId: 'card-1',
    deckId: 'deck-1',
    reviewedAt: at,
    studySessionId: 'session-1',
  });
  expect(event).toEqual({
    id: 'event-1',
    cardId: 'card-1',
    deckId: 'deck-1',
    reviewedAt: at,
    studySessionId: 'session-1',
    previousBox: 3,
    newBox: 4,
    result: 'success',
  });
  expect(Object.isFrozen(event)).toBe(true);
  expect(() => Object.assign(event, { newBox: 1 })).toThrow(TypeError);
  expect(transition.updatedReviewState.box).toBe(4);
});

test('due-queue result holds independent state copies without changing source elements', () => {
  const source = Object.freeze([Object.freeze(makeState({ cardId: 'card-1' }))]);
  const result = getDueReviewStates(source, date);
  expect(result[0]).toEqual(source[0]);
  expect(result[0]).not.toBe(source[0]);
  Object.assign(result[0]!, { box: 2 });
  expect(source[0]!.box).toBe(1);
});

test('initialization and scheduling read neither device time nor randomness', () => {
  const now = jest.spyOn(Date, 'now').mockImplementation(() => {
    throw new Error('Unexpected wall-clock read');
  });
  const random = jest.spyOn(Math, 'random').mockImplementation(() => {
    throw new Error('Unexpected random read');
  });
  try {
    const initial = createInitialReviewState('card-1', date, at);
    const next = calculateReviewTransition(initial, 'success', date, at);
    expect(next).toMatchObject({ newBox: 2, newDueDate: '2026-09-26' });
  } finally {
    now.mockRestore();
    random.mockRestore();
  }
});
