import {
  addCalendarDays,
  calendarDate,
  instant,
  requiredId,
  type CalendarDate,
  type Instant,
} from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import {
  reviewResult,
  validateReviewEvent,
  validateReviewState,
  type CardReviewState,
  type ReviewEvent,
  type ReviewResult,
} from './review';
import type { Scheduler, SchedulerDistribution, SchedulerTransition } from './review-engine';

export const SM2_SCHEDULER_ID = 'sm2';
const MIN_EASE_FACTOR = 1.3;

interface Sm2StateData {
  readonly repetitions: number;
  readonly intervalDays: number;
  readonly easeFactor: number;
}

function readData(state: CardReviewState): Sm2StateData {
  const schedulerState = state.schedulerState;
  if (!schedulerState || schedulerState.schedulerId !== SM2_SCHEDULER_ID) {
    throw new AppError('validation', 'Review state does not belong to SM-2.');
  }
  const repetitions = schedulerState.data.repetitions;
  const intervalDays = schedulerState.data.intervalDays;
  const easeFactor = schedulerState.data.easeFactor;
  if (
    typeof repetitions !== 'number' ||
    !Number.isSafeInteger(repetitions) ||
    repetitions < 0 ||
    typeof intervalDays !== 'number' ||
    !Number.isSafeInteger(intervalDays) ||
    intervalDays < 0 ||
    typeof easeFactor !== 'number' ||
    !Number.isFinite(easeFactor) ||
    easeFactor < MIN_EASE_FACTOR
  ) {
    throw new AppError('validation', 'Invalid SM-2 review state.');
  }
  return { repetitions, intervalDays, easeFactor };
}

function nextEaseFactor(easeFactor: number, result: ReviewResult): number {
  const quality = result === 'success' ? 5 : 2;
  return Number(
    Math.max(
      MIN_EASE_FACTOR,
      easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02),
    ).toFixed(2),
  );
}

export interface Sm2Transition extends SchedulerTransition {
  readonly previousRepetitions: number;
  readonly newRepetitions: number;
  readonly previousEaseFactor: number;
  readonly newEaseFactor: number;
}

export function calculateSm2Transition(
  current: CardReviewState,
  result: ReviewResult,
  reviewDate: CalendarDate,
  reviewedAt: Instant,
): Sm2Transition {
  const previous = validateReviewState(current);
  const data = readData(previous);
  reviewResult(result);
  const date = calendarDate(reviewDate);
  const time = instant(reviewedAt);
  if (time < previous.updatedAt)
    throw new AppError('validation', 'Review time cannot precede the saved review state.');

  const newEaseFactor = nextEaseFactor(data.easeFactor, result);
  const newRepetitions = result === 'success' ? data.repetitions + 1 : 0;
  const intervalDays =
    result === 'failure'
      ? 1
      : newRepetitions === 1
        ? 1
        : newRepetitions === 2
          ? 6
          : Math.max(1, Math.round(data.intervalDays * newEaseFactor));
  const newDueDate = addCalendarDays(date, intervalDays);
  const newState = newRepetitions === 0 ? 'learning' : newRepetitions < 2 ? 'learning' : 'review';

  return {
    previousState: previous.schedulerState!.key,
    newState,
    result,
    intervalDays,
    previousDueDate: previous.dueDate,
    newDueDate,
    previousRepetitions: data.repetitions,
    newRepetitions,
    previousEaseFactor: data.easeFactor,
    newEaseFactor,
    updatedReviewState: validateReviewState({
      ...previous,
      box: undefined,
      dueDate: newDueDate,
      lastReviewedAt: time,
      updatedAt: time,
      consecutiveSuccesses: result === 'success' ? previous.consecutiveSuccesses + 1 : 0,
      totalReviews: previous.totalReviews + 1,
      totalSuccesses: previous.totalSuccesses + (result === 'success' ? 1 : 0),
      schedulerState: {
        schedulerId: SM2_SCHEDULER_ID,
        key: newState,
        data: { repetitions: newRepetitions, intervalDays, easeFactor: newEaseFactor },
      },
    }),
  };
}

export const Sm2Scheduler: Scheduler = Object.freeze({
  id: SM2_SCHEDULER_ID,
  label: 'SM-2',
  localizedLabels: { fa: 'SM-2', ar: 'SM-2' },
  createInitialState(cardId: string, reviewDate: CalendarDate, createdAt: Instant) {
    return validateReviewState({
      cardId: requiredId(cardId, 'Card ID'),
      dueDate: calendarDate(reviewDate),
      lastReviewedAt: null,
      consecutiveSuccesses: 0,
      totalReviews: 0,
      totalSuccesses: 0,
      updatedAt: instant(createdAt),
      schedulerState: {
        schedulerId: SM2_SCHEDULER_ID,
        key: 'new',
        data: { repetitions: 0, intervalDays: 0, easeFactor: 2.5 },
      },
    });
  },
  processReview(
    current: CardReviewState,
    result: ReviewResult,
    reviewDate: CalendarDate,
    reviewedAt: Instant,
  ) {
    return calculateSm2Transition(current, result, reviewDate, reviewedAt);
  },
  getDueStates(states: readonly CardReviewState[], targetDate: CalendarDate): CardReviewState[] {
    const date = calendarDate(targetDate);
    return states
      .map((state) => validateReviewState(state))
      .filter((state) => state.dueDate <= date)
      .sort(
        (a, b) =>
          a.dueDate.localeCompare(b.dueDate) ||
          readData(a).repetitions - readData(b).repetitions ||
          a.cardId.localeCompare(b.cardId),
      );
  },
  getReviewStatus(state: CardReviewState) {
    const valid = validateReviewState(state);
    readData(valid);
    return {
      key: valid.schedulerState!.key,
      label:
        valid.schedulerState!.key === 'new'
          ? 'New'
          : valid.schedulerState!.key === 'learning'
            ? 'Learning'
            : 'Review',
    };
  },
  getQueuePriority(state: CardReviewState) {
    return readData(validateReviewState(state)).repetitions;
  },
  getDistribution(states: readonly CardReviewState[]): readonly SchedulerDistribution[] {
    const sections = ['new', 'learning', 'review'].map((key) => ({
      key,
      label: key[0]!.toUpperCase() + key.slice(1),
      count: 0,
    }));
    for (const state of states) {
      const key = validateReviewState(state).schedulerState?.key;
      const section = sections.find((item) => item.key === key);
      if (section) section.count++;
    }
    return sections;
  },
  createReviewEvent(
    transition: SchedulerTransition,
    input: Pick<ReviewEvent, 'id' | 'cardId' | 'deckId' | 'reviewedAt' | 'studySessionId'>,
  ) {
    return validateReviewEvent({
      ...input,
      result: transition.result,
      schedulerId: SM2_SCHEDULER_ID,
      previousState: transition.previousState,
      newState: transition.newState,
    });
  },
});
