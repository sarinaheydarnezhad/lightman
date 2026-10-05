import { calendarDate, instant, type Instant } from '@/core/domain/values';
import { createReviewEngine } from '@/features/study/domain/review-engine-impl';
import type { Scheduler } from '@/features/study/domain/review-engine';
import type { CardReviewState, ReviewResult } from '@/features/study/domain/review';

export function mergeReviewEvents(
  cardId: string,
  createdAt: Instant,
  events: readonly { readonly reviewedAt: Instant; readonly result: ReviewResult }[],
  scheduler: Scheduler = createReviewEngine().getScheduler(),
): CardReviewState {
  const firstDate = events.length ? events[0]!.reviewedAt.slice(0, 10) : createdAt.slice(0, 10);
  let state = scheduler.createInitialState(
    cardId,
    calendarDate(firstDate),
    instant(`${firstDate}T00:00:00.000Z`),
  );
  for (const event of events) {
    const effective = event.reviewedAt < state.updatedAt ? state.updatedAt : event.reviewedAt;
    state = scheduler.processReview(
      state,
      event.result,
      calendarDate(effective.slice(0, 10)),
      effective,
    ).updatedReviewState;
  }
  return state;
}
