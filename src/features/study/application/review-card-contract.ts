import type { SchedulerTransition } from '../domain/review-engine';
import type { ReviewEvent, ReviewResult } from '../domain/review';

export interface ReviewCardInput {
  readonly cardId: string;
  readonly deckId: string;
  readonly result: ReviewResult;
  readonly studySessionId: string | null;
}

export interface ReviewCardOutput extends SchedulerTransition {
  readonly previousBox?: ReviewEvent['previousBox'];
  readonly newBox?: ReviewEvent['newBox'];
  readonly reviewEvent: ReviewEvent;
}
