import { calendarDateAtInstant, now, requiredId } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import type { AppClock } from '@/core/ports/platform';
import type { Repositories } from '@/core/ports/repositories';
import { validateStudyScope } from '@/features/study/domain/study-session';
import {
  analyticsWindow,
  getStudySummary as calculateSummary,
  validateAnalyticsRange,
  type AnalyticsRange,
  type AnalyticsScope,
  type AnalyticsWindow,
} from '../domain/analytics';

export function createAnalyticsUseCases(
  repositories: Repositories,
  clock: AppClock,
  persistence: <T>(operation: () => Promise<T>) => Promise<T>,
) {
  const { decks, cards, reviews } = repositories;

  async function loadSummary(
    input: { readonly range: AnalyticsRange; readonly scope: AnalyticsScope },
    currentInstant = now(clock),
    timeZone = clock.timeZone(),
  ) {
    const range = validateAnalyticsRange(input.range);
    const scope = validateStudyScope(input.scope);
    const today = calendarDateAtInstant(currentInstant, timeZone);
    const [events, activeDecks] = await Promise.all([
      persistence(() =>
        reviews.listEvents(scope.kind === 'specific-deck' ? { deckId: scope.deckId } : {}),
      ),
      scope.kind === 'specific-deck'
        ? persistence(() => decks.getById(requiredId(scope.deckId, 'Deck ID'))).then((deck) =>
            deck && !deck.archivedAt ? [deck] : [],
          )
        : persistence(() => decks.list()),
    ]);
    const activeCards = (
      await Promise.all(activeDecks.map((deck) => persistence(() => cards.listByDeck(deck.id))))
    ).flat();
    const cardIds = activeCards.filter((card) => !card.archivedAt).map((card) => card.id);
    const states = cardIds.length ? await persistence(() => reviews.listStates(cardIds)) : [];
    const ids = new Set(cardIds);
    if (
      ids.size !== cardIds.length ||
      states.length !== ids.size ||
      new Set(states.map((state) => state.cardId)).size !== ids.size ||
      states.some((state) => !ids.has(state.cardId))
    )
      throw new AppError('not-found', 'Review state not found for an active card.');
    return calculateSummary(events, states, range, today, currentInstant, timeZone);
  }

  function getAnalyticsWindow(
    window: AnalyticsWindow = 30,
    scope: AnalyticsScope = { kind: 'all-decks' },
  ) {
    const currentInstant = now(clock);
    const timeZone = clock.timeZone();
    const today = calendarDateAtInstant(currentInstant, timeZone);
    return loadSummary({ range: analyticsWindow(today, window), scope }, currentInstant, timeZone);
  }

  return {
    getStudySummary: loadSummary,
    getAnalyticsWindow,
    async getCurrentStreak(scope: AnalyticsScope = { kind: 'all-decks' }) {
      return (await getAnalyticsWindow(30, scope)).currentStreak;
    },
    async getBestStreak(scope: AnalyticsScope = { kind: 'all-decks' }) {
      return (await getAnalyticsWindow(30, scope)).bestStreak;
    },
    async getCardsReviewedToday(scope: AnalyticsScope = { kind: 'all-decks' }) {
      return (await getAnalyticsWindow(30, scope)).cardsReviewedToday;
    },
    async getRetentionRate(range: AnalyticsRange, scope: AnalyticsScope = { kind: 'all-decks' }) {
      return (await loadSummary({ range, scope })).retentionRate;
    },
    async getBoxDistribution(scope: AnalyticsScope = { kind: 'all-decks' }) {
      return (await getAnalyticsWindow(30, scope)).boxDistribution;
    },
    async getDailyActivity(range: AnalyticsRange, scope: AnalyticsScope = { kind: 'all-decks' }) {
      return (await loadSummary({ range, scope })).dailyActivity;
    },
  };
}
