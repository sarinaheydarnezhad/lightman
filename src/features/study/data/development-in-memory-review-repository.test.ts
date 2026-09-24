import { makeEvent, makeState } from '@/../test/fixtures';
import { InMemoryReviewRepository } from './development-in-memory-review-repository';

test('review repository stores independent states and append-only event history', async () => {
  const reviews = new InMemoryReviewRepository();
  expect(await reviews.getState('card-1')).toBeNull();
  expect(await reviews.listEvents()).toEqual([]);
  await reviews.saveState(makeState());
  await reviews.addEvent(makeEvent());
  await reviews.addEvent(
    makeEvent({ id: 'event-2', cardId: 'card-2', deckId: 'deck-2', result: 'failure' }),
  );
  expect(await reviews.listEvents({ cardId: 'card-1' })).toHaveLength(1);
  expect(await reviews.listEvents({ deckId: 'deck-2' })).toHaveLength(1);
  expect(Object.isFrozen((await reviews.listEvents())[0])).toBe(true);
  await expect(reviews.addEvent(makeEvent())).rejects.toMatchObject({ code: 'conflict' });
  await expect(reviews.saveState(makeState({ box: 6 as never }))).rejects.toMatchObject({
    code: 'validation',
  });
  expect((await reviews.getState('card-1'))?.box).toBe(1);
});

test('record applies state and event together only after both validate', async () => {
  const reviews = new InMemoryReviewRepository();
  await reviews.saveState(makeState());
  await expect(
    reviews.record(makeEvent(), makeState({ cardId: 'wrong', totalReviews: 1 })),
  ).rejects.toMatchObject({ code: 'validation' });
  expect(await reviews.listEvents()).toEqual([]);
  expect((await reviews.getState('card-1'))?.totalReviews).toBe(0);
  await reviews.record(
    makeEvent(),
    makeState({ box: 2, totalReviews: 1, totalSuccesses: 1, consecutiveSuccesses: 1 }),
  );
  expect((await reviews.getState('card-1'))?.box).toBe(2);
  expect(await reviews.listEvents()).toHaveLength(1);
  await expect(
    reviews.record(
      makeEvent(),
      makeState({ box: 2, totalReviews: 2, totalSuccesses: 2, consecutiveSuccesses: 2 }),
    ),
  ).rejects.toMatchObject({ code: 'conflict' });
});
