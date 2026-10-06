import { calendarDate } from '@/core/domain/values';
import { makeState, timestamp } from '@/../test/fixtures';
import { calculateSm2Transition, Sm2Scheduler } from './sm2-scheduler';

const day = calendarDate('2026-09-24');

test('SM-2 creates a new card state with standard starting values', () => {
  expect(Sm2Scheduler.createInitialState('card-1', day, timestamp)).toMatchObject({
    dueDate: day,
    schedulerState: {
      schedulerId: 'sm2',
      key: 'new',
      data: { repetitions: 0, intervalDays: 0, easeFactor: 2.5 },
    },
  });
});

test('SM-2 success uses one-day then six-day intervals and increases ease', () => {
  const initial = Sm2Scheduler.createInitialState('card-1', day, timestamp);
  const first = calculateSm2Transition(initial, 'success', day, timestamp);
  expect(first).toMatchObject({ newState: 'learning', intervalDays: 1, newDueDate: '2026-09-25' });
  expect(first.updatedReviewState.schedulerState?.data).toEqual({
    repetitions: 1,
    intervalDays: 1,
    easeFactor: 2.6,
  });

  const second = calculateSm2Transition(first.updatedReviewState, 'success', day, timestamp);
  expect(second).toMatchObject({ newState: 'review', intervalDays: 6, newDueDate: '2026-09-30' });
  expect(second.updatedReviewState.schedulerState?.data).toEqual({
    repetitions: 2,
    intervalDays: 6,
    easeFactor: 2.7,
  });
});

test('SM-2 failure resets repetitions, lowers ease, and returns the card quickly', () => {
  const state = Sm2Scheduler.createInitialState('card-1', day, timestamp);
  const first = calculateSm2Transition(state, 'success', day, timestamp);
  const second = calculateSm2Transition(first.updatedReviewState, 'success', day, timestamp);
  const failed = calculateSm2Transition(second.updatedReviewState, 'failure', day, timestamp);
  expect(failed).toMatchObject({ newState: 'learning', intervalDays: 1, newDueDate: '2026-09-25' });
  expect(failed.updatedReviewState.schedulerState?.data).toEqual({
    repetitions: 0,
    intervalDays: 1,
    easeFactor: 2.38,
  });
});

test('SM-2 exposes due ordering, statuses, and distribution through the scheduler contract', () => {
  const newer = Sm2Scheduler.createInitialState('newer', day, timestamp);
  const learning = Sm2Scheduler.processReview(newer, 'success', day, timestamp).updatedReviewState;
  const review = Sm2Scheduler.processReview(learning, 'success', day, timestamp).updatedReviewState;
  const states = [makeState({ cardId: 'legacy' }), newer, learning, review];
  expect(Sm2Scheduler.getDueStates(states.slice(1), day)).toHaveLength(1);
  expect(Sm2Scheduler.getReviewStatus(newer)).toEqual({ key: 'new', label: 'New' });
  expect(Sm2Scheduler.getDistribution([newer, learning, review]).map((item) => item.count)).toEqual([
    1, 1, 1,
  ]);
});
