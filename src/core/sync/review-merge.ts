import { calendarDate, instant, type Instant } from '@/core/domain/values';
import { calculateReviewTransition, createInitialReviewState } from '@/features/study/domain/leitner-srs';
import type { CardReviewState, ReviewResult } from '@/features/study/domain/review';

export function mergeReviewEvents(
  cardId: string,
  createdAt: Instant,
  events: readonly { readonly reviewedAt: Instant; readonly result: ReviewResult }[],
): CardReviewState {
  const firstDate = events.length ? events[0]!.reviewedAt.slice(0, 10) : createdAt.slice(0, 10);
  let state = createInitialReviewState(cardId, calendarDate(firstDate), instant(`${firstDate}T00:00:00.000Z`));
  for (const event of events) {
    const effective = event.reviewedAt < state.updatedAt ? state.updatedAt : event.reviewedAt;
    state = calculateReviewTransition(state, event.result, calendarDate(effective.slice(0, 10)), effective).updatedReviewState;
  }
  return state;
}
