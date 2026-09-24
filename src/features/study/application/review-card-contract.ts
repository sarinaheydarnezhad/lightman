import type { ReviewTransition } from '../domain/leitner-srs';
import type { ReviewEvent, ReviewResult } from '../domain/review';

export interface ReviewCardInput {
  readonly cardId: string;
  readonly deckId: string;
  readonly result: ReviewResult;
  readonly studySessionId: string | null;
}

export interface ReviewCardOutput extends ReviewTransition {
  readonly reviewEvent: ReviewEvent;
}
