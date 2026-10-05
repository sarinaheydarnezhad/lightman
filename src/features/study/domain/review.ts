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

export interface SchedulerState {
  readonly schedulerId: string;
  readonly key: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface CardReviewState {
  readonly cardId: string;
  readonly box?: LeitnerBox;
  readonly schedulerState?: SchedulerState;
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
  readonly previousBox?: LeitnerBox;
  readonly newBox?: LeitnerBox;
  readonly schedulerId?: string;
  readonly previousState?: string;
  readonly newState?: string;
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
  if (!state.schedulerState || state.schedulerState.schedulerId === 'leitner')
    leitnerBox(state.box!);
  else validateSchedulerState(state.schedulerState);
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
  return {
    ...state,
    ...(state.schedulerState
      ? { schedulerState: validateSchedulerState(state.schedulerState) }
      : {}),
  };
}

export function validateReviewEvent(event: ReviewEvent): Readonly<ReviewEvent> {
  requiredId(event.id, 'Review event ID');
  requiredId(event.cardId, 'Card ID');
  requiredId(event.deckId, 'Deck ID');
  if (event.studySessionId !== null) requiredId(event.studySessionId, 'Study session ID');
  if (!event.schedulerId || event.schedulerId === 'leitner') {
    leitnerBox(event.previousBox!);
    leitnerBox(event.newBox!);
  } else {
    requiredId(event.schedulerId, 'Scheduler ID');
    requiredId(event.previousState!, 'Previous review state');
    requiredId(event.newState!, 'New review state');
  }
  reviewResult(event.result);
  instant(event.reviewedAt);
  return Object.freeze({ ...event });
}

export function validateSchedulerState(state: SchedulerState): SchedulerState {
  requiredId(state.schedulerId, 'Scheduler ID');
  requiredId(state.key, 'Review state');
  if (!state.data || typeof state.data !== 'object' || Array.isArray(state.data))
    throw new AppError('validation', 'Invalid scheduler data.');
  try {
    return { ...state, data: JSON.parse(JSON.stringify(state.data)) };
  } catch {
    throw new AppError('validation', 'Scheduler data must be serializable.');
  }
}

export function validateLeitnerReviewState(
  state: CardReviewState,
): CardReviewState & { readonly box: LeitnerBox } {
  const valid = validateReviewState(state);
  if (valid.schedulerState && valid.schedulerState.schedulerId !== 'leitner')
    throw new AppError('validation', 'Review state does not belong to Leitner.');
  return { ...valid, box: leitnerBox(valid.box!) };
}

export function assertReviewRecord(
  event: ReviewEvent,
  state: CardReviewState,
  previous: CardReviewState | null,
): void {
  const schedulerId = state.schedulerState?.schedulerId ?? 'leitner';
  if (
    state.cardId !== event.cardId ||
    (event.schedulerId ?? 'leitner') !== schedulerId ||
    state.totalReviews !== (previous?.totalReviews ?? 0) + 1 ||
    (schedulerId === 'leitner'
      ? state.box !== event.newBox || (previous?.box ?? 1) !== event.previousBox
      : state.schedulerState?.key !== event.newState ||
        (previous !== null && previous.schedulerState?.key !== event.previousState))
  )
    throw new AppError('validation', 'Review event and state disagree.');
}
