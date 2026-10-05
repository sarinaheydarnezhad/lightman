import { AppError } from '@/core/errors/app-error';
import { requiredId } from '@/core/domain/values';
import {
  validateReviewEvent,
  validateReviewState,
  assertReviewRecord,
  type CardReviewState,
  type ReviewEvent,
} from '../domain/review';
import type { ReviewRepository } from '../domain/review-repository';

/** Temporary session-only adapter. */
export class InMemoryReviewRepository implements ReviewRepository {
  private readonly states = new Map<string, CardReviewState>();
  private readonly events = new Map<string, ReviewEvent>();

  async getState(cardId: string): Promise<CardReviewState | null> {
    requiredId(cardId, 'Card ID');
    const state = this.states.get(cardId);
    return state ? validateReviewState(state) : null;
  }

  async listStates(cardIds: readonly string[]): Promise<CardReviewState[]> {
    return cardIds.flatMap((id) => {
      requiredId(id, 'Card ID');
      const state = this.states.get(id);
      return state ? [validateReviewState(state)] : [];
    });
  }

  async saveState(state: CardReviewState): Promise<CardReviewState> {
    const valid = validateReviewState(state);
    const existing = this.states.get(valid.cardId);
    if (existing && valid.updatedAt < existing.updatedAt)
      throw new AppError('conflict', 'Review state is older than the saved state.');
    this.states.set(valid.cardId, { ...valid });
    return validateReviewState(valid);
  }

  async addEvent(event: ReviewEvent): Promise<ReviewEvent> {
    const valid = validateReviewEvent(event);
    if (this.events.has(valid.id)) throw new AppError('conflict', 'Review event already exists.');
    this.events.set(valid.id, valid);
    return valid;
  }

  async record(event: ReviewEvent, state: CardReviewState): Promise<void> {
    const validEvent = validateReviewEvent(event);
    const validState = validateReviewState(state);
    const previous = this.states.get(validState.cardId);
    if (this.events.has(validEvent.id))
      throw new AppError('conflict', 'Review event already exists.');
    assertReviewRecord(validEvent, validState, previous ?? null);
    this.states.set(validState.cardId, { ...validState });
    this.events.set(validEvent.id, validEvent);
  }

  async countEvents(options: { cardId?: string; deckId?: string } = {}): Promise<number> {
    return (await this.listEvents(options)).length;
  }

  async listEvents(options: { cardId?: string; deckId?: string } = {}): Promise<ReviewEvent[]> {
    return Array.from(this.events.values())
      .filter(
        (event) =>
          (!options.cardId || event.cardId === options.cardId) &&
          (!options.deckId || event.deckId === options.deckId),
      )
      .map((event) => Object.freeze({ ...event }));
  }
}
