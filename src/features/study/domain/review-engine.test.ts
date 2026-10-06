import { calendarDate } from '@/core/domain/values';
import { makeState, timestamp } from '@/../test/fixtures';
import { testScheduler } from '@/../test/scheduler-fixture';
import { calculateReviewTransition, createReviewEvent, getDueReviewStates } from './leitner-srs';
import { LeitnerScheduler } from './leitner-scheduler';
import { Sm2Scheduler } from './sm2-scheduler';
import { createReviewEngine } from './review-engine-impl';

const day = calendarDate('2026-09-24');

test('implemented schedulers are listed, legacy selection defaults to Leitner, and unknown IDs fail safely', () => {
  const engine = createReviewEngine();
  expect(engine.getScheduler()).toBe(LeitnerScheduler);
  expect(engine.listSchedulers().map(({ id }) => id)).toEqual(['leitner', 'sm2']);
  expect(() => engine.getScheduler('fsrs')).toThrow('not available');
  expect(() => createReviewEngine([LeitnerScheduler, LeitnerScheduler])).toThrow();
  expect(() => createReviewEngine([testScheduler])).toThrow();
});

test.each([1, 2, 3, 4, 5] as const)(
  'LeitnerScheduler preserves success and failure transitions from box %i',
  (box) => {
    for (const result of ['success', 'failure'] as const) {
      const state = makeState({ box });
      const legacy = calculateReviewTransition(state, result, day, timestamp);
      const transition = LeitnerScheduler.processReview(state, result, day, timestamp);
      expect(transition).toMatchObject(legacy);
      const input = {
        id: 'event',
        cardId: state.cardId,
        deckId: 'deck',
        reviewedAt: timestamp,
        studySessionId: null,
      };
      expect(LeitnerScheduler.createReviewEvent(transition, input)).toEqual(
        createReviewEvent(legacy, input),
      );
      expect(state).toEqual(makeState({ box }));
    }
  },
);

test('initial state, due ordering, current status, and all five distribution buckets belong to the scheduler', () => {
  expect(LeitnerScheduler.createInitialState('card-1', day, timestamp)).toEqual(makeState());
  const states = [
    makeState({ cardId: 'a', box: 3 }),
    makeState({ cardId: 'b', box: 1 }),
    makeState({ cardId: 'c', box: 5, dueDate: calendarDate('2026-10-01') }),
  ];
  expect(LeitnerScheduler.getDueStates(states, day)).toEqual(getDueReviewStates(states, day));
  expect(LeitnerScheduler.getReviewStatus(states[0]!)).toEqual({ key: 'box-3', label: 'Box 3' });
  expect(LeitnerScheduler.getDistribution(states).map((section) => section.count)).toEqual([
    1, 0, 1, 0, 1,
  ]);
  expect(LeitnerScheduler.getDistribution([]).map((section) => section.label)).toEqual([
    'Box 1',
    'Box 2',
    'Box 3',
    'Box 4',
    'Box 5',
  ]);
});

test('engine aggregates same-system decks and keeps other scheduler sections independent without requiring boxes', () => {
  const engine = createReviewEngine([LeitnerScheduler, testScheduler]);
  const customState = testScheduler.createInitialState('custom', day, timestamp);
  expect(customState.box).toBeUndefined();
  const distribution = engine.getDistribution([
    { states: [makeState()] },
    { schedulerId: 'leitner', states: [makeState({ cardId: 'other', box: 2 })] },
    { schedulerId: testScheduler.id, states: [customState] },
  ]);
  expect(distribution[0]?.sections.map((section) => section.count)).toEqual([1, 1, 0, 0, 0]);
  expect(distribution[1]).toMatchObject({
    schedulerId: testScheduler.id,
    sections: [
      { key: 'new', count: 1 },
      { key: 'recalled', count: 0 },
      { key: 'practice', count: 0 },
    ],
  });
});
