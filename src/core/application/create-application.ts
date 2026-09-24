import { now, requiredId, type CalendarDate } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import type { AppClock, IdGenerator } from '@/core/ports/platform';
import type { Repositories } from '@/core/ports/repositories';
import { validateDeck, type Deck } from '@/features/decks/domain/deck';
import { validateCard, type Card } from '@/features/study/domain/card';
import {
  validateReviewState,
  type CardReviewState,
  type ReviewEvent,
  type ReviewResult,
  type LeitnerBox,
} from '@/features/study/domain/review';
import { validateUserSettings, type UserSettings } from '@/features/settings/domain/user-settings';

export type CreateDeckInput = Pick<
  Deck,
  'name' | 'description' | 'language' | 'textAlignment' | 'typographySize'
>;
export type UpdateDeckInput = Partial<CreateDeckInput>;
export type CreateCardInput = Pick<
  Card,
  'deckId' | 'frontText' | 'phonetic' | 'category' | 'meaning' | 'examples'
>;
export type UpdateCardInput = Partial<Omit<CreateCardInput, 'deckId'>>;

/** Use cases depend on domain contracts. The caller supplies the current adapters. */
export function createApplication(repositories: Repositories, clock: AppClock, ids: IdGenerator) {
  const { decks, cards, reviews, settings } = repositories;

  async function persistence<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('persistence', 'Unable to save or load your changes.', error);
    }
  }

  async function getDeck(id: string): Promise<Deck> {
    requiredId(id, 'Deck ID');
    const deck = await persistence(() => decks.getById(id));
    if (!deck || deck.archivedAt) throw new AppError('not-found', 'Deck not found.');
    return deck;
  }

  async function getCard(id: string): Promise<Card> {
    requiredId(id, 'Card ID');
    const card = await persistence(() => cards.getById(id));
    if (!card || card.archivedAt) throw new AppError('not-found', 'Card not found.');
    await getDeck(card.deckId);
    return card;
  }

  return {
    async createDeck(input: CreateDeckInput): Promise<Deck> {
      const time = now(clock);
      const deck = validateDeck({
        ...input,
        id: ids.create(),
        createdAt: time,
        updatedAt: time,
        archivedAt: null,
      });
      return persistence(() => decks.create(deck));
    },
    getDeck,
    listDecks(options?: { search?: string }): Promise<Deck[]> {
      return persistence(() => decks.list(options));
    },
    async updateDeck(id: string, changes: UpdateDeckInput): Promise<Deck> {
      const deck = await getDeck(id);
      const updated = validateDeck({ ...deck, ...changes, updatedAt: now(clock) });
      return persistence(() => decks.update(updated));
    },
    async archiveDeck(id: string): Promise<Deck> {
      await getDeck(id);
      return persistence(() => decks.archive(id, now(clock)));
    },
    async createCard(input: CreateCardInput): Promise<Card> {
      await getDeck(input.deckId);
      const time = now(clock);
      const card = validateCard({
        ...input,
        id: ids.create(),
        createdAt: time,
        updatedAt: time,
        archivedAt: null,
      });
      return persistence(() => cards.create(card));
    },
    getCard,
    async listCardsForDeck(
      deckId: string,
      options?: { search?: string; category?: string },
    ): Promise<Card[]> {
      await getDeck(deckId);
      return persistence(() => cards.listByDeck(deckId, options));
    },
    async searchCards(deckId: string, search: string, category?: string): Promise<Card[]> {
      await getDeck(deckId);
      return persistence(() => cards.listByDeck(deckId, { search, category }));
    },
    async countActiveCardsForDeck(deckId: string): Promise<number> {
      await getDeck(deckId);
      return persistence(() => cards.countByDeck(deckId));
    },
    async listCardCategoriesForDeck(deckId: string): Promise<string[]> {
      await getDeck(deckId);
      return persistence(() => cards.listCategoriesByDeck(deckId));
    },
    async updateCard(id: string, changes: UpdateCardInput): Promise<Card> {
      const card = await getCard(id);
      return persistence(() =>
        cards.update(validateCard({ ...card, ...changes, updatedAt: now(clock) })),
      );
    },
    async archiveCard(id: string): Promise<Card> {
      await getCard(id);
      return persistence(() => cards.archive(id, now(clock)));
    },
    async getReviewState(cardId: string): Promise<CardReviewState | null> {
      await getCard(cardId);
      return persistence(() => reviews.getState(cardId));
    },
    async listReviewEvents(options?: { cardId?: string; deckId?: string }): Promise<ReviewEvent[]> {
      return persistence(() => reviews.listEvents(options));
    },
    /** Scheduling is supplied by the future engine; this use case records validated facts atomically. */
    async recordReview(input: {
      cardId: string;
      result: ReviewResult;
      newBox: LeitnerBox;
      dueDate: CalendarDate;
      studySessionId: string | null;
      consecutiveSuccesses: number;
    }): Promise<ReviewEvent> {
      const card = await getCard(input.cardId);
      const previous = await persistence(() => reviews.getState(card.id));
      const time = now(clock);
      const event: ReviewEvent = {
        id: ids.create(),
        cardId: card.id,
        deckId: card.deckId,
        previousBox: previous?.box ?? 1,
        newBox: input.newBox,
        result: input.result,
        reviewedAt: time,
        studySessionId: input.studySessionId,
      };
      const state = validateReviewState({
        cardId: card.id,
        box: input.newBox,
        dueDate: input.dueDate,
        lastReviewedAt: time,
        consecutiveSuccesses: input.consecutiveSuccesses,
        totalReviews: (previous?.totalReviews ?? 0) + 1,
        totalSuccesses: (previous?.totalSuccesses ?? 0) + (input.result === 'success' ? 1 : 0),
        updatedAt: time,
      });
      await persistence(() => reviews.record(event, state));
      return Object.freeze({ ...event });
    },
    getSettings(): Promise<UserSettings | null> {
      return persistence(() => settings.get());
    },
    async updateSettings(changes: Partial<UserSettings>): Promise<UserSettings> {
      const previous = await persistence(() => settings.get());
      if (!previous) throw new AppError('not-found', 'Settings not found.');
      return persistence(() => settings.update(validateUserSettings({ ...previous, ...changes })));
    },
    async getHomeSummary() {
      const deckList = await persistence(() => decks.list());
      const countsByDeck = await Promise.all(
        deckList.map((deck) => persistence(() => cards.countByDeck(deck.id))),
      );
      const reviewEvents = await persistence(() => reviews.listEvents());
      return {
        decks: deckList,
        cardCount: countsByDeck.reduce((count, deckCount) => count + deckCount, 0),
        reviewCount: reviewEvents.length,
      };
    },
  };
}

export type Application = ReturnType<typeof createApplication>;
