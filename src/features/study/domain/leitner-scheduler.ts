import type { CalendarDate, Instant } from '@/core/domain/values';
import {
  calculateReviewTransition,
  createInitialReviewState,
  createReviewEvent,
  getDueReviewStates,
  type ReviewTransition,
} from './leitner-srs';
import {
  validateLeitnerReviewState,
  type CardReviewState,
  type ReviewEvent,
  type ReviewResult,
} from './review';
import type { Scheduler, SchedulerDistribution, SchedulerTransition } from './review-engine';

function transition(
  value: ReviewTransition,
): SchedulerTransition & Pick<ReviewTransition, 'previousBox' | 'newBox'> {
  return {
    previousState: `box-${value.previousBox}`,
    previousBox: value.previousBox,
    newState: `box-${value.newBox}`,
    newBox: value.newBox,
    result: value.result,
    intervalDays: value.intervalDays,
    previousDueDate: value.previousDueDate,
    newDueDate: value.newDueDate,
    updatedReviewState: value.updatedReviewState,
  };
}

export const LeitnerScheduler: Scheduler = Object.freeze({
  id: 'leitner',
  label: 'Leitner',
  localizedLabels: { fa: 'لایتنر', ar: 'لايتنر' },
  createInitialState(cardId: string, reviewDate: CalendarDate, createdAt: Instant) {
    return createInitialReviewState(cardId, reviewDate, createdAt);
  },
  processReview(
    current: CardReviewState,
    result: ReviewResult,
    reviewDate: CalendarDate,
    reviewedAt: Instant,
  ) {
    return transition(calculateReviewTransition(current, result, reviewDate, reviewedAt));
  },
  getDueStates(states: readonly CardReviewState[], targetDate: CalendarDate) {
    return getDueReviewStates(states, targetDate);
  },
  getReviewStatus(state: CardReviewState) {
    const { box } = validateLeitnerReviewState(state);
    return { key: `box-${box}`, label: `Box ${box}` };
  },
  getQueuePriority(state: CardReviewState) {
    return validateLeitnerReviewState(state).box;
  },
  getDistribution(states: readonly CardReviewState[]): readonly SchedulerDistribution[] {
    const counts = [1, 2, 3, 4, 5].map((box) => ({
      key: `box-${box}`,
      label: `Box ${box}`,
      localizedLabels: {
        fa: `جعبهٔ ${box.toLocaleString('fa-IR')}`,
        ar: `الصندوق ${box.toLocaleString('ar')}`,
      },
      count: 0,
    }));
    for (const state of states) counts[validateLeitnerReviewState(state).box - 1]!.count++;
    return counts;
  },
  createReviewEvent(
    value: SchedulerTransition,
    input: Pick<ReviewEvent, 'id' | 'cardId' | 'deckId' | 'reviewedAt' | 'studySessionId'>,
  ) {
    return createReviewEvent(
      {
        previousBox: Number(
          value.previousState.replace('box-', ''),
        ) as ReviewTransition['previousBox'],
        newBox: Number(value.newState.replace('box-', '')) as ReviewTransition['newBox'],
        result: value.result,
        intervalDays: value.intervalDays,
        previousDueDate: value.previousDueDate,
        newDueDate: value.newDueDate,
        updatedReviewState: value.updatedReviewState,
      },
      input,
    );
  },
});
