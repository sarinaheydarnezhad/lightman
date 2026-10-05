import { LeitnerScheduler } from './leitner-scheduler';
import { AppError } from '@/core/errors/app-error';
import { requiredId } from '@/core/domain/values';
import type { CardReviewState } from './review';
import type { ReviewEngine, Scheduler } from './review-engine';

export function createReviewEngine(
  schedulers: readonly Scheduler[] = [LeitnerScheduler],
): ReviewEngine {
  const registered = [...schedulers];
  const schedulerIds = registered.map((scheduler) => requiredId(scheduler.id, 'Scheduler ID'));
  if (!schedulerIds.includes('leitner') || new Set(schedulerIds).size !== schedulerIds.length)
    throw new AppError('validation', 'Schedulers must be unique and include Leitner.');
  function getScheduler(id = 'leitner'): Scheduler {
    const scheduler = registered.find((candidate) => candidate.id === id);
    if (!scheduler) throw new AppError('validation', 'Review system is not available.');
    return scheduler;
  }
  return {
    getScheduler,
    createInitialState(cardId, reviewDate, createdAt, schedulerId) {
      return getScheduler(schedulerId).createInitialState(cardId, reviewDate, createdAt);
    },
    processReview(current, result, reviewDate, reviewedAt, schedulerId) {
      return getScheduler(schedulerId).processReview(current, result, reviewDate, reviewedAt);
    },
    createReviewEvent(transition, input, schedulerId) {
      return getScheduler(schedulerId).createReviewEvent(transition, input);
    },
    getDueStates(states, targetDate, schedulerId) {
      return getScheduler(schedulerId).getDueStates(states, targetDate);
    },
    getReviewStatus(state, schedulerId) {
      return getScheduler(schedulerId).getReviewStatus(state);
    },
    getQueuePriority(state, schedulerId) {
      return getScheduler(schedulerId).getQueuePriority(state);
    },
    listSchedulers() {
      return [...registered];
    },
    getDistribution(groups) {
      const statesByScheduler = new Map<string, CardReviewState[]>();
      for (const group of groups) {
        const scheduler = getScheduler(group.schedulerId);
        statesByScheduler.set(scheduler.id, [
          ...(statesByScheduler.get(scheduler.id) ?? []),
          ...group.states,
        ]);
      }
      return [...statesByScheduler].map(([schedulerId, states]) => {
        const scheduler = getScheduler(schedulerId);
        return {
          schedulerId,
          label: scheduler.label,
          localizedLabels: scheduler.localizedLabels,
          sections: scheduler.getDistribution(states),
        };
      });
    },
  };
}
