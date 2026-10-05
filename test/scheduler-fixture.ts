import { addCalendarDays } from '@/core/domain/values';
import type { Scheduler } from '@/features/study/domain/review-engine';
import { validateReviewEvent, validateReviewState } from '@/features/study/domain/review';

export const testScheduler: Scheduler = {
  id: 'test-scheduler',
  label: 'Test scheduler',
  createInitialState(cardId, dueDate, updatedAt) {
    return validateReviewState({
      cardId,
      dueDate,
      updatedAt,
      lastReviewedAt: null,
      consecutiveSuccesses: 0,
      totalReviews: 0,
      totalSuccesses: 0,
      schedulerState: { schedulerId: 'test-scheduler', key: 'new', data: { repetitions: 0 } },
    });
  },
  processReview(current, result, reviewDate, reviewedAt) {
    const next = result === 'success' ? 'recalled' : 'practice';
    const dueDate = addCalendarDays(reviewDate, 1);
    return {
      previousState: current.schedulerState!.key,
      newState: next,
      result,
      intervalDays: 1,
      previousDueDate: current.dueDate,
      newDueDate: dueDate,
      updatedReviewState: validateReviewState({
        ...current,
        dueDate,
        lastReviewedAt: reviewedAt,
        updatedAt: reviewedAt,
        consecutiveSuccesses: result === 'success' ? current.consecutiveSuccesses + 1 : 0,
        totalReviews: current.totalReviews + 1,
        totalSuccesses: current.totalSuccesses + (result === 'success' ? 1 : 0),
        schedulerState: {
          schedulerId: 'test-scheduler',
          key: next,
          data: { repetitions: current.totalReviews + 1 },
        },
      }),
    };
  },
  getDueStates(states, targetDate) {
    return states.filter((state) => state.dueDate <= targetDate);
  },
  getReviewStatus(state) {
    return { key: state.schedulerState!.key, label: state.schedulerState!.key };
  },
  getQueuePriority() {
    return 0;
  },
  getDistribution(states) {
    return ['new', 'recalled', 'practice'].map((key) => ({
      key,
      label: key,
      count: states.filter((state) => state.schedulerState?.key === key).length,
    }));
  },
  createReviewEvent(transition, input) {
    return validateReviewEvent({
      ...input,
      result: transition.result,
      schedulerId: 'test-scheduler',
      previousState: transition.previousState,
      newState: transition.newState,
    });
  },
};
