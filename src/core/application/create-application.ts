import { calendarDateAtInstant, now, requiredId } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import type { AppClock, IdGenerator } from '@/core/ports/platform';
import type { Repositories } from '@/core/ports/repositories';
import type { NotificationService } from '@/core/ports/notification';
import { createSettingsUseCases } from '@/features/settings/application/create-settings-use-cases';
import { validateDeck, type Deck } from '@/features/decks/domain/deck';
import { validateCard, type Card } from '@/features/study/domain/card';
import {
  reviewResult,
  type CardReviewState,
  type ReviewEvent,
} from '@/features/study/domain/review';
import type { UserSettings } from '@/features/settings/domain/user-settings';
import { createStudyUseCases } from '@/features/study/application/create-study-use-cases';
import { createAnalyticsUseCases } from '@/features/analytics/application/create-analytics-use-cases';
import { createReviewEngine } from '@/features/study/domain/review-engine-impl';
import type { ReviewEngine } from '@/features/study/domain/review-engine';
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
  'name' | 'description' | 'language' | 'textAlignment' | 'typographySize' | 'reviewSystem'
>;
export type UpdateDeckInput = Partial<CreateDeckInput>;
export type CreateCardInput = Pick<
  Card,
  'deckId' | 'frontText' | 'phonetic' | 'category' | 'meaning' | 'examples'
>;
export type UpdateCardInput = Partial<Omit<CreateCardInput, 'deckId'>>;

/** Use cases depend on domain contracts. The caller supplies the current adapters. */
export function createApplication(
  repositories: Repositories,
  clock: AppClock,
  ids: IdGenerator,
  notificationService: NotificationService = {
    getPermissionStatus: async () => 'unavailable',
    requestPermission: async () => 'unavailable',
    getScheduledReminder: async () => null,
    scheduleDailyReminder: async () => {
      throw new AppError('unavailable', 'Reminders unavailable.');
    },
    cancelDailyReminder: async () => {},
    openSystemSettings: async () => {},
    subscribeToReminderTaps: () => () => {},
    consumeLastReminderTap: () => false,
  },
  reviewEngine: ReviewEngine = createReviewEngine(),
) {
  const { decks, cards, reviews, settings } = repositories;
  const settingsUseCases = createSettingsUseCases(settings, notificationService);

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

  async function prepareReview(input: ReviewCardInput): Promise<ReviewCardOutput> {
    requiredId(input.cardId, 'Card ID');
    requiredId(input.deckId, 'Deck ID');
    reviewResult(input.result);
    if (input.studySessionId !== null) requiredId(input.studySessionId, 'Study session ID');
    const card = await getCard(input.cardId);
    const cardDeck = await getDeck(card.deckId);
    if (card.deckId !== input.deckId)
      throw new AppError('validation', 'Card does not belong to the requested deck.');
    const previous = await persistence(() => reviews.getState(card.id));
    if (!previous) throw new AppError('not-found', 'Review state not found.');
    const time = now(clock);
    const transition = reviewEngine.processReview(
      previous,
      input.result,
      calendarDateAtInstant(time, clock.timeZone()),
      time,
      cardDeck.reviewSystem,
    );
    const reviewEvent = reviewEngine.createReviewEvent(
      transition,
      {
        id: ids.create(),
        cardId: card.id,
        deckId: card.deckId,
        reviewedAt: time,
        studySessionId: input.studySessionId,
      },
      cardDeck.reviewSystem,
    );
    return { ...transition, reviewEvent };
  }

  async function reviewCard(input: ReviewCardInput): Promise<ReviewCardOutput> {
    const review = await prepareReview(input);
    await persistence(() => reviews.record(review.reviewEvent, review.updatedReviewState));
    return review;
  }

  const study = createStudyUseCases({
    repositories,
    clock,
    ids,
    getDeck,
    reviewCard,
    prepareReview,
    persistence,
    reviewEngine,
  });
  const analytics = createAnalyticsUseCases(repositories, clock, persistence, reviewEngine);

  return {
    ...study,
    ...analytics,
    listSchedulers() {
      return reviewEngine
        .listSchedulers()
        .map(({ id, label, localizedLabels }) => ({ id, label, localizedLabels }));
    },
    async getDeckDistribution(deckId: string) {
      const deck = await getDeck(deckId);
      const activeCards = (await persistence(() => cards.listByDeck(deckId))).filter(
        (card) => !card.archivedAt,
      );
      const states = await persistence(() =>
        reviews.listStates(activeCards.map((card) => card.id)),
      );
      if (states.length !== activeCards.length)
        throw new AppError('not-found', 'Review state not found for an active card.');
      return reviewEngine.getDistribution([{ schedulerId: deck.reviewSystem, states }])[0]!;
    },
    async getCardReviewStatus(cardId: string) {
      const card = await getCard(cardId);
      const deck = await getDeck(card.deckId);
      const state = await persistence(() => reviews.getState(cardId));
      if (!state) throw new AppError('not-found', 'Review state not found.');
      return reviewEngine.getReviewStatus(state, deck.reviewSystem);
    },
    async createDeck(input: CreateDeckInput): Promise<Deck> {
      reviewEngine.getScheduler(input.reviewSystem);
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
      const selected = reviewEngine.getScheduler(changes.reviewSystem ?? deck.reviewSystem);
      if (
        selected.id !== (deck.reviewSystem ?? 'leitner') &&
        (await persistence(() => cards.countByDeck(id)))
      )
        throw new AppError(
          'conflict',
          'Changing review systems requires an empty deck. Existing progress is preserved.',
        );
      const updated = validateDeck({ ...deck, ...changes, updatedAt: now(clock) });
      return persistence(() => decks.update(updated));
    },
    async archiveDeck(id: string): Promise<Deck> {
      await getDeck(id);
      return persistence(() => decks.archive(id, now(clock)));
    },
    async createCard(input: CreateCardInput): Promise<Card> {
      const deck = await getDeck(input.deckId);
      const time = now(clock);
      const card = validateCard({
        ...input,
        id: ids.create(),
        createdAt: time,
        updatedAt: time,
        archivedAt: null,
      });
      const initialState = reviewEngine.createInitialState(
        card.id,
        calendarDateAtInstant(time, clock.timeZone()),
        time,
        deck.reviewSystem,
      );
      if (repositories.cardCreation)
        return persistence(() =>
          repositories.cardCreation!.createWithInitialReviewState(card, initialState),
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
    async getCardListSnapshot(
      deckId: string,
      options: { search?: string; category?: string } = {},
    ) {
      const deck = await getDeck(deckId);
      const [cardList, categories, totalCount] = await Promise.all([
        persistence(() => cards.listByDeck(deckId, options)),
        persistence(() => cards.listCategoriesByDeck(deckId)),
        persistence(() => cards.countByDeck(deckId)),
      ]);
      return { deck, cards: cardList, categories, totalCount };
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
    settings: settingsUseCases,
    getSettings(): Promise<UserSettings | null> {
      return persistence(() => settingsUseCases.get());
    },
    async updateSettings(changes: Partial<UserSettings>): Promise<UserSettings> {
      return persistence(() => settingsUseCases.update(changes));
    },
    async getHomeSummary() {
      const deckList = await persistence(() => decks.list());
      const countsByDeck = await Promise.all(
        deckList.map((deck) => persistence(() => cards.countByDeck(deck.id))),
      );
      const reviewCount = await persistence(() => reviews.countEvents());
      return {
        decks: deckList,
        cardCount: countsByDeck.reduce((count, deckCount) => count + deckCount, 0),
        reviewCount,
      };
    },
  };
}

export type Application = ReturnType<typeof createApplication>;
