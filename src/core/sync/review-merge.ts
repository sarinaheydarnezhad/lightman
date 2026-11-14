import { calendarDate, instant, type Instant } from '@/core/domain/values';
import { createReviewEngine } from '@/features/study/domain/review-engine-impl';
import type { Scheduler } from '@/features/study/domain/review-engine';
import {
  validateReviewState,
  type CardReviewState,
  type ReviewResult,
} from '@/features/study/domain/review';
import {
  validateReviewCalendar,
  type ReviewCalendar,
} from '@/features/study/domain/review-calendar';

export interface ReviewReplayBaseline {
  readonly state: CardReviewState;
  readonly throughVersion: number;
  readonly includedEventIds: readonly string[];
}

export interface ReplayEvent {
  readonly id?: string;
  readonly reviewedAt: Instant;
  readonly result: ReviewResult;
  readonly reviewCalendar?: ReviewCalendar;
  readonly serverVersion?: number;
}

export function mergeReviewEvents(
  cardId: string,
  createdAt: Instant,
  events: readonly ReplayEvent[],
  scheduler: Scheduler = createReviewEngine().getScheduler(),
  baseline?: ReviewReplayBaseline,
): CardReviewState {
  const firstDate = events.length ? events[0]!.reviewedAt.slice(0, 10) : createdAt.slice(0, 10);
  let state = baseline
    ? validateReviewState(baseline.state)
    : scheduler.createInitialState(
        cardId,
        calendarDate(firstDate),
        instant(`${firstDate}T00:00:00.000Z`),
      );
  if (state.cardId !== cardId) throw new Error('Review baseline belongs to another card.');
  if (
    baseline &&
    (!Number.isSafeInteger(baseline.throughVersion) ||
      baseline.throughVersion < 0 ||
      (state.schedulerState?.schedulerId ?? 'leitner') !== scheduler.id)
  )
    throw new Error('Invalid review baseline.');
  const seen = new Set(baseline?.includedEventIds);
  const identities = new Map<string, string>();
  const ordered = [...events].sort(
    (a, b) =>
      (a.serverVersion ?? Number.MAX_SAFE_INTEGER) - (b.serverVersion ?? Number.MAX_SAFE_INTEGER),
  );
  for (const event of ordered) {
    if (event.id) {
      const identity = JSON.stringify([
        event.reviewedAt,
        event.result,
        event.reviewCalendar ?? null,
      ]);
      if (identities.has(event.id) && identities.get(event.id) !== identity)
        throw new Error('Review event identity collision; history was retained.');
      identities.set(event.id, identity);
    }
    if (
      (event.id && seen.has(event.id)) ||
      (baseline &&
        event.serverVersion !== undefined &&
        event.serverVersion <= baseline.throughVersion)
    )
      continue;
    if (event.id) seen.add(event.id);
    const reviewDate = event.reviewCalendar
      ? validateReviewCalendar(event.reviewCalendar, event.reviewedAt).reviewDate
      : calendarDate(event.reviewedAt.slice(0, 10));
    state = scheduler.processReview(
      state,
      event.result,
      reviewDate,
      event.reviewedAt,
    ).updatedReviewState;
  }
  return state;
}
