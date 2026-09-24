import { calendarDate, languageTag } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import { seedDevelopmentData } from '@/core/composition/development-seed';
import {
  makeRepositories,
  fixedClock,
  sequenceIds,
  makeDeck,
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
  expect((await app.getCard(card.id)).frontText).toBe('term');
  expect((await app.updateDeck(deck.id, { name: 'Updated deck' })).name).toBe('Updated deck');
  expect((await app.updateCard(card.id, { meaning: 'Updated meaning' })).meaning).toBe(
    'Updated meaning',
  );
  expect((await app.getHomeSummary()).cardCount).toBe(1);
  await app.archiveCard(card.id);
  expect(await app.listCardsForDeck(deck.id)).toEqual([]);
  await expect(app.getCard(card.id)).rejects.toMatchObject({ code: 'not-found' });
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

test('review use case records facts and state without calculating an SRS schedule', async () => {
  const repositories = makeRepositories();
  await repositories.decks.create(makeDeck());
  await repositories.cards.create({
    id: 'card-1',
    deckId: 'deck-1',
    frontText: 'word',
    meaning: 'meaning',
    phonetic: null,
    category: null,
    examples: [],
    createdAt: makeDeck().createdAt,
    updatedAt: makeDeck().createdAt,
    archivedAt: null,
  });
  const app = createApplication(repositories, fixedClock, sequenceIds());
  const event = await app.recordReview({
    cardId: 'card-1',
    result: 'success',
    newBox: 2,
    dueDate: calendarDate('2026-09-25'),
    studySessionId: null,
    consecutiveSuccesses: 1,
  });
  expect(event.previousBox).toBe(1);
  expect(Object.isFrozen(event)).toBe(true);
  expect((await app.getReviewState('card-1'))?.box).toBe(2);
  expect(await app.listReviewEvents({ deckId: 'deck-1' })).toEqual([event]);
  await expect(
    app.recordReview({
      cardId: 'missing',
      result: 'failure',
      newBox: 1,
      dueDate: calendarDate('2026-09-25'),
      studySessionId: null,
      consecutiveSuccesses: 0,
    }),
  ).rejects.toMatchObject({ code: 'not-found' });
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
  expect(await repositories.decks.list()).toHaveLength(3);
  expect((await repositories.decks.list()).map((deck) => deck.typographySize)).toEqual([
    'small',
    'medium',
    'large',
  ]);
  expect(await repositories.cards.listByDeck('everyday-phrases')).toHaveLength(2);
  expect((await repositories.cards.listByDeck('travel-basics'))[0]?.examples).toEqual([]);
  expect(await repositories.reviews.listEvents()).toHaveLength(2);
  expect((await repositories.reviews.getState('phrase-hello'))?.box).toBe(3);
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
