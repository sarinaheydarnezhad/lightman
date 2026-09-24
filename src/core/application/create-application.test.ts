import { calendarDate, languageTag } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import { seedDevelopmentData } from '@/core/composition/development-seed';
import {
  makeRepositories,
  fixedClock,
  sequenceIds,
  makeDeck,
  makeCard,
  makeSettings,
} from '@/../test/fixtures';
import { createApplication } from './create-application';

test('the complete create, load, update, archive and reload flow uses only repository contracts', async () => {
  const repositories = makeRepositories();
  const app = createApplication(repositories, fixedClock, sequenceIds());
  expect(await app.listDecks()).toEqual([]);
  const deck = await app.createDeck({
    name: ' New deck ',
    description: '',
    language: languageTag('fa-IR'),
    textAlignment: 'rtl',
    typographySize: 'large',
  });
  expect((await app.getDeck(deck.id)).name).toBe('New deck');
  expect(await app.listDecks({ search: 'NEW' })).toHaveLength(1);
  const card = await app.createCard({
    deckId: deck.id,
    frontText: ' term ',
    meaning: 'meaning',
    phonetic: null,
    category: null,
    examples: [{ sentence: 'In a sentence.' }],
  });
  expect(await app.listCardsForDeck(deck.id)).toEqual([card]);
  expect(await app.countActiveCardsForDeck(deck.id)).toBe(1);
  expect((await app.searchCards(deck.id, '  TERM  ')).map((item) => item.id)).toEqual([card.id]);
  expect(await app.listCardCategoriesForDeck(deck.id)).toEqual([]);
  expect((await app.getCard(card.id)).frontText).toBe('term');
  expect(await app.getReviewState(card.id)).toMatchObject({
    box: 1,
    dueDate: calendarDate('2026-09-24'),
    lastReviewedAt: null,
    totalReviews: 0,
  });
  expect((await app.updateDeck(deck.id, { name: 'Updated deck' })).name).toBe('Updated deck');
  expect((await app.updateCard(card.id, { meaning: 'Updated meaning' })).meaning).toBe(
    'Updated meaning',
  );
  expect((await app.getHomeSummary()).cardCount).toBe(1);
  await app.archiveCard(card.id);
  expect(await app.listCardsForDeck(deck.id)).toEqual([]);
  expect(await app.countActiveCardsForDeck(deck.id)).toBe(0);
  expect(await app.searchCards(deck.id, 'term')).toEqual([]);
  await expect(app.getCard(card.id)).rejects.toMatchObject({ code: 'not-found' });
  await expect(app.countActiveCardsForDeck('missing-deck')).rejects.toMatchObject({
    code: 'not-found',
  });
  await app.archiveDeck(deck.id);
  expect(await app.listDecks()).toEqual([]);
  await expect(app.getDeck(deck.id)).rejects.toMatchObject({ code: 'not-found' });
  expect((await repositories.decks.list({ includeArchived: true }))[0]?.name).toBe('Updated deck');
});

test('separate decks may share a name without overwriting either ID', async () => {
  const app = createApplication(makeRepositories(), fixedClock, sequenceIds());
  const input = {
    name: 'Practice',
    description: '',
    language: languageTag('en'),
    textAlignment: 'ltr' as const,
    typographySize: 'medium' as const,
  };
  const first = await app.createDeck(input);
  const second = await app.createDeck(input);
  expect(first.id).not.toBe(second.id);
  expect((await app.listDecks()).map((deck) => deck.id)).toEqual([first.id, second.id]);
});

test('use cases reject missing parents and translate unexpected adapter failures', async () => {
  const repositories = makeRepositories();
  const app = createApplication(repositories, fixedClock, sequenceIds());
  await expect(
    app.createCard({
      deckId: 'missing',
      frontText: 'x',
      meaning: 'y',
      phonetic: null,
      category: null,
      examples: [],
    }),
  ).rejects.toMatchObject({ code: 'not-found' });
  await expect(app.updateSettings({ theme: 'dark' })).rejects.toMatchObject({ code: 'not-found' });
  await repositories.decks.create(makeDeck());
  const duplicateIds = { create: () => 'same-id' };
  const duplicateApp = createApplication(repositories, fixedClock, duplicateIds);
  const input = {
    name: 'First',
    description: '',
    language: languageTag('en'),
    textAlignment: 'ltr' as const,
    typographySize: 'small' as const,
  };
  await duplicateApp.createDeck(input);
  await expect(duplicateApp.createDeck(input)).rejects.toMatchObject({ code: 'conflict' });
  const failed = createApplication(
    {
      ...repositories,
      decks: {
        ...repositories.decks,
        getById: async () => {
          throw new Error('Internal details');
        },
      },
    },
    fixedClock,
    sequenceIds(),
  );
  await expect(failed.getDeck('deck-1')).rejects.toMatchObject({
    code: 'persistence',
    message: 'Unable to save or load your changes.',
  });
});

test('reviewCard calculates and records one state transition and immutable event per call', async () => {
  const repositories = makeRepositories();
  await repositories.decks.create(makeDeck());
  await repositories.cards.create(makeCard());
  const app = createApplication(repositories, fixedClock, sequenceIds());
  await expect(
    app.reviewCard({ cardId: 'card-1', deckId: 'deck-1', result: 'success', studySessionId: null }),
  ).rejects.toMatchObject({ code: 'not-found', message: 'Review state not found.' });
  const initial = await repositories.reviews.saveState({
    cardId: 'card-1',
    box: 1,
    dueDate: calendarDate('2026-09-24'),
    lastReviewedAt: null,
    consecutiveSuccesses: 0,
    totalReviews: 0,
    totalSuccesses: 0,
    updatedAt: makeCard().createdAt,
  });
  const record = jest.spyOn(repositories.reviews, 'record');
  const request = {
    cardId: 'card-1',
    deckId: 'deck-1',
    result: 'success' as const,
    studySessionId: 'session-1',
  };
  const first = await app.reviewCard(request);
  expect(record).toHaveBeenCalledTimes(1);
  expect(record).toHaveBeenCalledWith(first.reviewEvent, first.updatedReviewState);
  expect(first).toMatchObject({
    previousBox: 1,
    newBox: 2,
    intervalDays: 2,
    newDueDate: calendarDate('2026-09-26'),
  });
  expect(first.reviewEvent).toMatchObject({
    cardId: 'card-1',
    deckId: 'deck-1',
    result: 'success',
    previousBox: 1,
    newBox: 2,
    studySessionId: 'session-1',
  });
  expect(Object.isFrozen(first.reviewEvent)).toBe(true);
  expect(first.updatedReviewState).toEqual(await app.getReviewState('card-1'));
  expect(initial.totalReviews).toBe(0);
  const second = await app.reviewCard(request);
  expect(record).toHaveBeenCalledTimes(2);
  expect(second).toMatchObject({ previousBox: 2, newBox: 3, intervalDays: 4 });
  expect(second.reviewEvent.id).not.toBe(first.reviewEvent.id);
  expect((await app.getReviewState('card-1'))?.totalReviews).toBe(2);
  expect(await app.listReviewEvents({ deckId: 'deck-1' })).toEqual([
    first.reviewEvent,
    second.reviewEvent,
  ]);
  const failure = await app.reviewCard({ ...request, result: 'failure' });
  expect(failure).toMatchObject({
    previousBox: 3,
    newBox: 1,
    intervalDays: 0,
    newDueDate: calendarDate('2026-09-24'),
  });
  expect(failure.updatedReviewState).toMatchObject({
    totalReviews: 3,
    totalSuccesses: 2,
    consecutiveSuccesses: 0,
  });
  await expect(
    app.reviewCard({
      cardId: 'missing',
      deckId: 'deck-1',
      result: 'failure',
      studySessionId: null,
    }),
  ).rejects.toMatchObject({ code: 'not-found' });
  await expect(app.reviewCard({ ...request, deckId: 'other' })).rejects.toMatchObject({
    code: 'validation',
  });
  await expect(app.reviewCard({ ...request, result: 'maybe' as never })).rejects.toMatchObject({
    code: 'validation',
  });
});

test('reviewCard and new-card initialization use the clock’s current local calendar date', async () => {
  const repositories = makeRepositories();
  await repositories.decks.create(makeDeck());
  const localClock = {
    now: () => new Date('2026-09-24T23:30:00.000Z'),
    timeZone: () => 'Asia/Tehran',
  };
  const app = createApplication(repositories, localClock, sequenceIds());
  const card = await app.createCard({
    deckId: 'deck-1',
    frontText: 'night',
    meaning: 'after dark',
    phonetic: null,
    category: null,
    examples: [],
  });
  expect((await app.getReviewState(card.id))?.dueDate).toBe('2026-09-25');
  const transition = await app.reviewCard({
    cardId: card.id,
    deckId: 'deck-1',
    result: 'success',
    studySessionId: null,
  });
  expect(transition).toMatchObject({ newBox: 2, newDueDate: '2026-09-27' });
  expect(transition.reviewEvent.reviewedAt).toBe('2026-09-24T23:30:00.000Z');
});

test('settings update through use case validates partial changes', async () => {
  const repositories = makeRepositories();
  await repositories.settings.update(makeSettings());
  const app = createApplication(repositories, fixedClock, sequenceIds());
  expect((await app.updateSettings({ theme: 'oled' })).theme).toBe('oled');
  await expect(
    app.updateSettings({ dailyReminderEnabled: true, dailyReminderTime: null }),
  ).rejects.toBeInstanceOf(AppError);
  expect((await app.getSettings())?.theme).toBe('oled');
});

test('development seeding is explicit, small and idempotent', async () => {
  const repositories = makeRepositories();
  expect(await repositories.decks.list()).toEqual([]);
  await seedDevelopmentData(repositories);
  await seedDevelopmentData(repositories);
  expect(await repositories.decks.list()).toHaveLength(4);
  expect((await repositories.decks.list()).map((deck) => deck.typographySize)).toEqual([
    'small',
    'medium',
    'large',
    'medium',
  ]);
  expect(await repositories.cards.listByDeck('everyday-phrases')).toHaveLength(2);
  expect(await repositories.cards.countByDeck('fresh-collection')).toBe(0);
  expect((await repositories.cards.getById('phrase-hello'))?.examples).toHaveLength(2);
  expect((await repositories.cards.getById('phrase-hello'))?.category).toBe('Greetings');
  expect((await repositories.cards.listByDeck('travel-basics'))[0]?.examples).toEqual([]);
  expect(await repositories.reviews.listEvents()).toHaveLength(2);
  expect((await repositories.reviews.getState('phrase-hello'))?.box).toBe(3);
  for (const cardId of ['phrase-thanks', 'root-port', 'travel-salaam']) {
    expect(await repositories.reviews.getState(cardId)).toMatchObject({
      box: 1,
      dueDate: calendarDate('2026-01-01'),
      totalReviews: 0,
    });
  }
  expect((await repositories.settings.get())?.theme).toBe('system');
});

test('development seed fills only missing review events when partially seeded', async () => {
  const repositories = makeRepositories();
  await repositories.reviews.addEvent({
    id: 'seed-review-2',
    cardId: 'phrase-hello',
    deckId: 'everyday-phrases',
    previousBox: 2,
    newBox: 3,
    result: 'success',
    reviewedAt: makeDeck().createdAt,
    studySessionId: null,
  });
  await seedDevelopmentData(repositories);
  expect((await repositories.reviews.listEvents()).map((event) => event.id).sort()).toEqual([
    'seed-review-1',
    'seed-review-2',
  ]);
});
