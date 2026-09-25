import { calendarDateAtInstant, now, requiredId } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import type { AppClock, IdGenerator } from '@/core/ports/platform';
import type { Repositories } from '@/core/ports/repositories';
import { validateDeck, type Deck } from '@/features/decks/domain/deck';
import { validateCard, type Card } from '@/features/study/domain/card';
import {
  reviewResult,
  type CardReviewState,
  type ReviewEvent,
} from '@/features/study/domain/review';
import {
  calculateReviewTransition,
  createInitialReviewState,
  createReviewEvent,
} from '@/features/study/domain/leitner-srs';
import { validateUserSettings, type UserSettings } from '@/features/settings/domain/user-settings';
import { createStudyUseCases } from '@/features/study/application/create-study-use-cases';
import { createAnalyticsUseCases } from '@/features/analytics/application/create-analytics-use-cases';
import type {
  ReviewCardInput,
  ReviewCardOutput,
} from '@/features/study/application/review-card-contract';

export type {
  ReviewCardInput,
  ReviewCardOutput,
} from '@/features/study/application/review-card-contract';

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

  async function reviewCard(input: ReviewCardInput): Promise<ReviewCardOutput> {
    requiredId(input.cardId, 'Card ID');
    requiredId(input.deckId, 'Deck ID');
    reviewResult(input.result);
    if (input.studySessionId !== null) requiredId(input.studySessionId, 'Study session ID');
    const card = await getCard(input.cardId);
    if (card.deckId !== input.deckId)
      throw new AppError('validation', 'Card does not belong to the requested deck.');
    const previous = await persistence(() => reviews.getState(card.id));
    if (!previous) throw new AppError('not-found', 'Review state not found.');
    const time = now(clock);
    const transition = calculateReviewTransition(
      previous,
      input.result,
      calendarDateAtInstant(time, clock.timeZone()),
      time,
    );
    const reviewEvent = createReviewEvent(transition, {
      id: ids.create(),
      cardId: card.id,
      deckId: card.deckId,
      reviewedAt: time,
      studySessionId: input.studySessionId,
    });
    await persistence(() => reviews.record(reviewEvent, transition.updatedReviewState));
    return { ...transition, reviewEvent };
  }

  const study = createStudyUseCases({ repositories, clock, ids, getDeck, reviewCard, persistence });
  const analytics = createAnalyticsUseCases(repositories, clock, persistence);

  return {
    ...study,
    ...analytics,
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
      const initialState = createInitialReviewState(
        card.id,
        calendarDateAtInstant(time, clock.timeZone()),
        time,
      );
      const created = await persistence(() => cards.create(card));
      await persistence(() => reviews.saveState(initialState));
      return created;
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
    reviewCard,
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
