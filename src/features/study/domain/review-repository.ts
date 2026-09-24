import type { CardReviewState, ReviewEvent } from './review';

export interface ReviewRepository {
  getState(cardId: string): Promise<CardReviewState | null>;
  saveState(state: CardReviewState): Promise<CardReviewState>;
  addEvent(event: ReviewEvent): Promise<ReviewEvent>;
  record(event: ReviewEvent, state: CardReviewState): Promise<void>;
  listEvents(options?: { cardId?: string; deckId?: string }): Promise<ReviewEvent[]>;
}
