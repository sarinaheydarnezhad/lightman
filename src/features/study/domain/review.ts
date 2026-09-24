import {
  calendarDate,
  instant,
  requiredId,
  type CalendarDate,
  type Instant,
} from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';

export type LeitnerBox = 1 | 2 | 3 | 4 | 5;
export type ReviewResult = 'success' | 'failure';

export interface CardReviewState {
  readonly cardId: string;
  readonly box: LeitnerBox;
  readonly dueDate: CalendarDate;
  readonly lastReviewedAt: Instant | null;
  readonly consecutiveSuccesses: number;
  readonly totalReviews: number;
  readonly totalSuccesses: number;
  readonly updatedAt: Instant;
}

export interface ReviewEvent {
  readonly id: string;
  readonly cardId: string;
  readonly deckId: string;
  readonly previousBox: LeitnerBox;
  readonly newBox: LeitnerBox;
  readonly result: ReviewResult;
  readonly reviewedAt: Instant;
  readonly studySessionId: string | null;
}

export function leitnerBox(value: number): LeitnerBox {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new AppError('validation', 'Leitner box must be 1 through 5.');
  }
  return value as LeitnerBox;
}

export function reviewResult(value: unknown): ReviewResult {
  if (value !== 'success' && value !== 'failure')
    throw new AppError('validation', 'Invalid review result.');
  return value;
}

export function validateReviewState(state: CardReviewState): CardReviewState {
  requiredId(state.cardId, 'Card ID');
  leitnerBox(state.box);
  calendarDate(state.dueDate);
  instant(state.updatedAt);
  if (state.lastReviewedAt !== null) instant(state.lastReviewedAt);
  if (state.lastReviewedAt !== null && state.lastReviewedAt > state.updatedAt) {
    throw new AppError('validation', 'Review timestamps are out of order.');
  }
  for (const count of [state.consecutiveSuccesses, state.totalReviews, state.totalSuccesses]) {
    if (!Number.isSafeInteger(count) || count < 0)
      throw new AppError('validation', 'Review counts must be nonnegative integers.');
  }
  if (
    state.totalSuccesses > state.totalReviews ||
    state.consecutiveSuccesses > state.totalSuccesses
  ) {
    throw new AppError('validation', 'Review counts are inconsistent.');
  }
  return { ...state };
}

export function validateReviewEvent(event: ReviewEvent): Readonly<ReviewEvent> {
  requiredId(event.id, 'Review event ID');
  requiredId(event.cardId, 'Card ID');
  requiredId(event.deckId, 'Deck ID');
  if (event.studySessionId !== null) requiredId(event.studySessionId, 'Study session ID');
  leitnerBox(event.previousBox);
  leitnerBox(event.newBox);
  reviewResult(event.result);
  instant(event.reviewedAt);
  return Object.freeze({ ...event });
}
