import { createApplication } from '@/core/application/create-application';
import { makeDeck, makeRepositories, fixedClock, sequenceIds } from '@/../test/fixtures';
import { testScheduler } from '@/../test/scheduler-fixture';
import { LeitnerScheduler } from '../domain/leitner-scheduler';
import { Sm2Scheduler } from '../domain/sm2-scheduler';
import { createReviewEngine } from '../domain/review-engine-impl';

const cardInput = {
  frontText: 'Term',
  meaning: 'Meaning',
  phonetic: null,
  category: null,
  examples: [],
};

test('existing decks without a selection persist as Leitner and updating configuration does not reset progress or history', async () => {
  const repos = makeRepositories();
  await repos.decks.create(makeDeck({ reviewSystem: undefined }));
  const app = createApplication(repos, fixedClock, sequenceIds());
  expect((await app.getDeck('deck-1')).reviewSystem).toBe('leitner');
  const card = await app.createCard({ ...cardInput, deckId: 'deck-1' });
  await app.reviewCard({
    cardId: card.id,
    deckId: card.deckId,
    result: 'success',
    studySessionId: null,
  });
  const before = await app.getReviewState(card.id);
  await app.updateDeck('deck-1', { reviewSystem: 'leitner' });
  expect(await app.getReviewState(card.id)).toEqual(before);
  expect(await app.listReviewEvents()).toHaveLength(1);
  await expect(app.updateDeck('deck-1', { reviewSystem: 'fsrs' })).rejects.toMatchObject({
    code: 'validation',
  });
  expect(await app.getReviewState(card.id)).toEqual(before);
});

test('each deck uses its persisted scheduler for creation, study, events, statuses, and analytics', async () => {
  const repos = makeRepositories();
  const engine = createReviewEngine([LeitnerScheduler, testScheduler]);
  const app = createApplication(repos, fixedClock, sequenceIds(), undefined, engine);
  await repos.decks.create(makeDeck());
  await repos.decks.create(makeDeck({ id: 'custom', reviewSystem: testScheduler.id }));
  const classic = await app.createCard({ ...cardInput, deckId: 'deck-1' });
  const custom = await app.createCard({ ...cardInput, deckId: 'custom' });
  expect((await app.getReviewState(classic.id))?.box).toBe(1);
  expect((await app.getReviewState(custom.id))?.box).toBeUndefined();
  const session = await app.startStudySession({ kind: 'specific-deck', deckId: 'custom' });
  const item = (await app.getCurrentStudyItem(session.id))!;
  await app.submitStudyAnswer({
    sessionId: session.id,
    cardId: item.cardId,
    presentationId: item.presentationId,
    result: 'success',
  });
  expect(await app.getCardReviewStatus(custom.id)).toEqual({ key: 'recalled', label: 'recalled' });
  expect((await app.listReviewEvents())[0]).toMatchObject({
    schedulerId: testScheduler.id,
    previousState: 'new',
    newState: 'recalled',
  });
  expect(await app.getDeckDistribution('custom')).toMatchObject({
    schedulerId: testScheduler.id,
    sections: [{ count: 0 }, { count: 1 }, { count: 0 }],
  });
  expect((await app.getAnalyticsWindow()).distribution.map((group) => group.schedulerId)).toEqual([
    'leitner',
    testScheduler.id,
  ]);
  expect(
    await app.getRetentionRate({ from: '2026-09-24' as never, to: '2026-09-24' as never }),
  ).toBe(100);
  await expect(app.updateDeck('custom', { reviewSystem: 'leitner' })).rejects.toMatchObject({
    code: 'conflict',
  });
  const reloaded = createApplication(repos, fixedClock, sequenceIds(), undefined, engine);
  expect((await reloaded.getDeck('custom')).reviewSystem).toBe(testScheduler.id);
});

test('scheduler selection persists per empty deck and distribution excludes archived cards', async () => {
  const repos = makeRepositories();
  const app = createApplication(
    repos,
    fixedClock,
    sequenceIds(),
    undefined,
    createReviewEngine([LeitnerScheduler, testScheduler]),
  );
  await repos.decks.create(makeDeck());
  await repos.decks.create(makeDeck({ id: 'unchanged' }));
  await app.updateDeck('deck-1', { reviewSystem: testScheduler.id });
  expect((await repos.decks.getById('deck-1'))?.reviewSystem).toBe(testScheduler.id);
  expect((await repos.decks.getById('unchanged'))?.reviewSystem).toBe('leitner');
  const card = await app.createCard({ ...cardInput, deckId: 'deck-1' });
  await app.archiveCard(card.id);
  expect(
    (await app.getDeckDistribution('deck-1')).sections.every((section) => section.count === 0),
  ).toBe(true);
});

test('SM-2 can be selected for a new deck and is used for its cards and reviews', async () => {
  const repos = makeRepositories();
  const app = createApplication(
    repos,
    fixedClock,
    sequenceIds(),
    undefined,
    createReviewEngine([LeitnerScheduler, Sm2Scheduler]),
  );
  await app.createDeck({
    name: 'SM-2 deck',
    description: '',
    language: 'en' as never,
    textAlignment: 'ltr',
    typographySize: 'medium',
    reviewSystem: 'sm2',
  });
  const deck = await app.getDeck('generated-1');
  expect(deck.reviewSystem).toBe('sm2');
  const card = await app.createCard({ ...cardInput, deckId: deck.id });
  expect((await app.getReviewState(card.id))?.schedulerState).toMatchObject({ schedulerId: 'sm2' });
  const review = await app.reviewCard({
    cardId: card.id,
    deckId: deck.id,
    result: 'success',
    studySessionId: null,
  });
  expect(review.reviewEvent).toMatchObject({ schedulerId: 'sm2', previousState: 'new', newState: 'learning' });
  expect((await app.getReviewState(card.id))?.dueDate).toBe('2026-09-25');
});
