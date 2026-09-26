import type { CardReviewState, ReviewEvent } from './review';

export interface ReviewRepository {
  getState(cardId: string): Promise<CardReviewState | null>;
  /** Bulk read for current-state summaries; missing IDs remain missing. */
  listStates(cardIds: readonly string[]): Promise<CardReviewState[]>;
  saveState(state: CardReviewState): Promise<CardReviewState>;
  addEvent(event: ReviewEvent): Promise<ReviewEvent>;
  record(event: ReviewEvent, state: CardReviewState): Promise<void>;
  countEvents(options?: { cardId?: string; deckId?: string }): Promise<number>;
  listEvents(options?: { cardId?: string; deckId?: string }): Promise<ReviewEvent[]>;
}
