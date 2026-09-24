import {
  makeCard,
  makeDeck,
  makeRepositories,
  makeState,
  sequenceIds,
  fixedClock,
} from '@/../test/fixtures';
import { calendarDate, instant } from '@/core/domain/values';
import { createInitialReviewState } from '@/features/study/domain/leitner-srs';
import { createApplication } from './create-application';

async function setupReview() {
  const repositories = makeRepositories();
  await repositories.decks.create(makeDeck());
  await repositories.cards.create(makeCard());
  const app = createApplication(repositories, fixedClock, sequenceIds());
  const request = {
    cardId: 'card-1',
    deckId: 'deck-1',
    result: 'success' as const,
    studySessionId: 'session-1',
  };
  return { repositories, app, request };
}

test('ReviewCard loads initial state and records exactly one success transition and event', async () => {
  const { repositories, app, request } = await setupReview();
  const initial = createInitialReviewState(
    'card-1',
    calendarDate('2026-09-24'),
    instant('2026-09-24T10:00:00.000Z'),
  );
  await repositories.reviews.saveState(initial);
  const record = jest.spyOn(repositories.reviews, 'record');
  const output = await app.reviewCard(request);
  expect(output).toMatchObject({
    previousBox: 1,
    newBox: 2,
    intervalDays: 2,
    previousDueDate: '2026-09-24',
    newDueDate: '2026-09-26',
  });
  expect(output.updatedReviewState).toEqual({
    cardId: 'card-1',
    box: 2,
    dueDate: '2026-09-26',
    lastReviewedAt: '2026-09-24T10:00:00.000Z',
    updatedAt: '2026-09-24T10:00:00.000Z',
    totalReviews: 1,
    totalSuccesses: 1,
    consecutiveSuccesses: 1,
  });
  expect(output.reviewEvent).toEqual({
    id: 'generated-1',
    cardId: 'card-1',
    deckId: 'deck-1',
    previousBox: 1,
    newBox: 2,
    result: 'success',
    reviewedAt: '2026-09-24T10:00:00.000Z',
    studySessionId: 'session-1',
  });
  expect(record).toHaveBeenCalledTimes(1);
  expect(record).toHaveBeenCalledWith(output.reviewEvent, output.updatedReviewState);
  expect(await app.getReviewState('card-1')).toEqual(output.updatedReviewState);
  expect(await app.listReviewEvents({ cardId: 'card-1' })).toEqual([output.reviewEvent]);
  expect(initial.totalReviews).toBe(0);
});

test('ReviewCard applies repeated success and same-day failure as distinct history', async () => {
  const { repositories, app, request } = await setupReview();
  await repositories.reviews.saveState(
    createInitialReviewState(
      'card-1',
      calendarDate('2026-09-24'),
      instant('2026-09-24T10:00:00.000Z'),
    ),
  );
  const first = await app.reviewCard(request);
  const second = await app.reviewCard(request);
  const failure = await app.reviewCard({ ...request, result: 'failure' });
  expect(second).toMatchObject({ previousBox: 2, newBox: 3, newDueDate: '2026-09-28' });
  expect(failure).toMatchObject({
    previousBox: 3,
    newBox: 1,
    intervalDays: 0,
    newDueDate: '2026-09-24',
    updatedReviewState: { totalReviews: 3, totalSuccesses: 2, consecutiveSuccesses: 0 },
  });
  expect((await app.listReviewEvents({ deckId: 'deck-1' })).map((event) => event.id)).toEqual([
    first.reviewEvent.id,
    second.reviewEvent.id,
    failure.reviewEvent.id,
  ]);
  expect(new Set([first.reviewEvent.id, second.reviewEvent.id, failure.reviewEvent.id]).size).toBe(
    3,
  );
  expect(Object.isFrozen(first.reviewEvent)).toBe(true);
  expect(await app.getReviewState('card-1')).toEqual(failure.updatedReviewState);
});

test('ReviewCard rejects a missing card, missing state, invalid result, or mismatched deck without writing', async () => {
  const { repositories, app, request } = await setupReview();
  const record = jest.spyOn(repositories.reviews, 'record');
  await expect(app.reviewCard(request)).rejects.toMatchObject({
    code: 'not-found',
    message: 'Review state not found.',
  });
  await expect(app.reviewCard({ ...request, cardId: '' })).rejects.toMatchObject({
    code: 'validation',
  });
  await expect(app.reviewCard({ ...request, cardId: 'absent' })).rejects.toMatchObject({
    code: 'not-found',
  });
  await expect(app.reviewCard({ ...request, deckId: '' })).rejects.toMatchObject({
    code: 'validation',
  });
  await expect(app.reviewCard({ ...request, deckId: 'other' })).rejects.toMatchObject({
    code: 'validation',
  });
  await expect(app.reviewCard({ ...request, result: 'maybe' as never })).rejects.toMatchObject({
    code: 'validation',
  });
  await expect(app.reviewCard({ ...request, studySessionId: ' ' })).rejects.toMatchObject({
    code: 'validation',
  });
  expect(record).not.toHaveBeenCalled();
  expect(await repositories.reviews.listEvents()).toEqual([]);
});

test('ReviewCard translates repository failure and leaves state and event unchanged', async () => {
  const { repositories, app, request } = await setupReview();
  const initial = makeState();
  await repositories.reviews.saveState(initial);
  const record = jest
    .spyOn(repositories.reviews, 'record')
    .mockRejectedValueOnce(new Error('internal adapter detail'));
  await expect(app.reviewCard(request)).rejects.toMatchObject({
    code: 'persistence',
    message: 'Unable to save or load your changes.',
  });
  expect(record).toHaveBeenCalledTimes(1);
  expect(await repositories.reviews.getState('card-1')).toEqual(initial);
  expect(await repositories.reviews.listEvents()).toEqual([]);
  record.mockRestore();
  const getState = jest
    .spyOn(repositories.reviews, 'getState')
    .mockRejectedValueOnce(new Error('internal adapter detail'));
  await expect(app.reviewCard(request)).rejects.toMatchObject({ code: 'persistence' });
  getState.mockRestore();
});

test('ReviewCard uses current clock time zone to schedule the local review day', async () => {
  const repositories = makeRepositories();
  await repositories.decks.create(makeDeck());
  const app = createApplication(
    repositories,
    {
      now: () => new Date('2026-09-24T23:30:00.000Z'),
      timeZone: () => 'Asia/Tehran',
    },
    sequenceIds(),
  );
  const card = await app.createCard({
    deckId: 'deck-1',
    frontText: 'night',
    meaning: 'after dark',
    phonetic: null,
    category: null,
    examples: [],
  });
  expect((await app.getReviewState(card.id))?.dueDate).toBe('2026-09-25');
  const output = await app.reviewCard({
    cardId: card.id,
    deckId: 'deck-1',
    result: 'success',
    studySessionId: null,
  });
  expect(output).toMatchObject({ newBox: 2, newDueDate: '2026-09-27' });
  expect(output.reviewEvent.reviewedAt).toBe('2026-09-24T23:30:00.000Z');
});
