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
  leitnerBox,
  reviewResult,
  validateReviewEvent,
  validateReviewState,
  type CardReviewState,
  type LeitnerBox,
  type ReviewEvent,
  type ReviewResult,
} from './review';

export interface LeitnerIntervalPolicy {
  getIntervalDays(box: LeitnerBox): number;
}

/** The interval belongs to the box reached after a successful review. */
export const defaultLeitnerIntervalPolicy: LeitnerIntervalPolicy = Object.freeze({
  getIntervalDays(box: LeitnerBox): number {
    leitnerBox(box);
    return 2 ** (box - 1);
  },
});

export function getIntervalDays(
  box: LeitnerBox,
  policy: LeitnerIntervalPolicy = defaultLeitnerIntervalPolicy,
): number {
  leitnerBox(box);
  const days = policy.getIntervalDays(box);
  if (!Number.isSafeInteger(days) || days < 1)
    throw new AppError('validation', 'Review interval must be a positive number of calendar days.');
  return days;
}

export function createInitialReviewState(
  cardId: string,
  reviewDate: CalendarDate,
  createdAt: Instant,
): CardReviewState {
  return validateReviewState({
    cardId: requiredId(cardId, 'Card ID'),
    box: 1,
    dueDate: calendarDate(reviewDate),
    lastReviewedAt: null,
    consecutiveSuccesses: 0,
    totalReviews: 0,
    totalSuccesses: 0,
    updatedAt: instant(createdAt),
  });
}

export interface ReviewTransition {
  readonly previousBox: LeitnerBox;
  readonly newBox: LeitnerBox;
  readonly result: ReviewResult;
  /** Zero on failure, because the card is due again on the review date. */
  readonly intervalDays: number;
  readonly previousDueDate: CalendarDate;
  readonly newDueDate: CalendarDate;
  readonly updatedReviewState: CardReviewState;
}

/** One call computes exactly one immutable-in/immutable-out review transition. */
export function calculateReviewTransition(
  current: CardReviewState,
  result: ReviewResult,
  reviewDate: CalendarDate,
  reviewedAt: Instant,
  policy: LeitnerIntervalPolicy = defaultLeitnerIntervalPolicy,
): ReviewTransition {
  const previous = validateReviewState(current);
  reviewResult(result);
  calendarDate(reviewDate);
  instant(reviewedAt);
  if (reviewedAt < previous.updatedAt)
    throw new AppError('validation', 'Review time cannot precede the saved review state.');
  const newBox = result === 'failure' ? 1 : leitnerBox(Math.min(previous.box + 1, 5));
  const intervalDays = result === 'failure' ? 0 : getIntervalDays(newBox, policy);
  const newDueDate = result === 'failure' ? reviewDate : addCalendarDays(reviewDate, intervalDays);
  const updatedReviewState = validateReviewState({
    ...previous,
    box: newBox,
    dueDate: newDueDate,
    lastReviewedAt: reviewedAt,
    updatedAt: reviewedAt,
    totalReviews: previous.totalReviews + 1,
    totalSuccesses: previous.totalSuccesses + (result === 'success' ? 1 : 0),
    consecutiveSuccesses: result === 'success' ? previous.consecutiveSuccesses + 1 : 0,
  });
  return {
    previousBox: previous.box,
    newBox,
    result,
    intervalDays,
    previousDueDate: previous.dueDate,
    newDueDate,
    updatedReviewState,
  };
}

export function isCardDue(dueDate: CalendarDate, today: CalendarDate): boolean {
  calendarDate(dueDate);
  calendarDate(today);
  return dueDate <= today;
}

/** Deterministic queue: earliest date, then lower box, then card ID. */
export function getDueReviewStates(
  states: readonly CardReviewState[],
  targetDate: CalendarDate,
): CardReviewState[] {
  calendarDate(targetDate);
  return states
    .map(validateReviewState)
    .filter((state) => isCardDue(state.dueDate, targetDate))
    .sort(
      (a, b) =>
        (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0) ||
        a.box - b.box ||
        (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0),
    );
}

export function createReviewEvent(
  transition: ReviewTransition,
  input: Pick<ReviewEvent, 'id' | 'cardId' | 'deckId' | 'reviewedAt' | 'studySessionId'>,
): ReviewEvent {
  if (
    input.cardId !== transition.updatedReviewState.cardId ||
    input.reviewedAt !== transition.updatedReviewState.lastReviewedAt
  )
    throw new AppError('validation', 'Review event and transition disagree.');
  return validateReviewEvent({
    ...input,
    previousBox: transition.previousBox,
    newBox: transition.newBox,
    result: transition.result,
  });
}
