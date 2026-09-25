import { makeCard, makeDeck, makeEvent, makeRepositories, makeState } from '@/../test/fixtures';
import { calendarDate, instant } from '@/core/domain/values';
import { createAnalyticsUseCases } from './create-analytics-use-cases';

const at = instant('2026-09-25T12:00:00.000Z');
const clock = { now: () => new Date(at), timeZone: () => 'UTC' };
const passthrough = <T>(action: () => Promise<T>) => action();

test('deck scope retains archived historical events but excludes archived active state', async () => {
  const repositories = makeRepositories();
  await repositories.decks.create(makeDeck({ id: 'a' }));
  await repositories.decks.create(makeDeck({ id: 'b' }));
  await repositories.cards.create(makeCard({ id: 'card-a', deckId: 'a' }));
  await repositories.cards.create(makeCard({ id: 'card-b', deckId: 'b' }));
  await repositories.reviews.saveState(makeState({ cardId: 'card-a', box: 3 }));
  await repositories.reviews.saveState(makeState({ cardId: 'card-b', box: 5 }));
  await repositories.reviews.addEvent(
    makeEvent({ id: 'one', cardId: 'card-a', deckId: 'a', reviewedAt: at }),
  );
  await repositories.reviews.addEvent(
    makeEvent({ id: 'two', cardId: 'card-b', deckId: 'b', result: 'failure', reviewedAt: at }),
  );
  const analytics = createAnalyticsUseCases(repositories, clock, passthrough);
  expect(await analytics.getAnalyticsWindow(7)).toMatchObject({
    range: { from: '2026-09-19', to: '2026-09-25' },
    totalReviews: 2,
    retentionRate: 50,
    activeCardCount: 2,
    boxDistribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 },
  });
  await repositories.cards.archive('card-a', at);
  await repositories.decks.archive('b', at);
  const a = await analytics.getAnalyticsWindow(7, { kind: 'specific-deck', deckId: 'a' });
  const b = await analytics.getAnalyticsWindow(7, { kind: 'specific-deck', deckId: 'b' });
  expect(a).toMatchObject({ totalReviews: 1, retentionRate: 100, activeCardCount: 0 });
  expect(b).toMatchObject({ totalReviews: 1, retentionRate: 0, activeCardCount: 0 });
  expect((await analytics.getAnalyticsWindow()).boxDistribution).toEqual({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  });
  expect(await repositories.reviews.listEvents()).toHaveLength(2);
});

test('focused operations, explicit range, and missing active states', async () => {
  const repositories = makeRepositories();
  await repositories.decks.create(makeDeck());
  await repositories.cards.create(makeCard());
  const analytics = createAnalyticsUseCases(repositories, clock, passthrough);
  await expect(analytics.getAnalyticsWindow()).rejects.toMatchObject({ code: 'not-found' });
  await repositories.reviews.saveState(makeState());
  expect((await analytics.getAnalyticsWindow()).totalReviews).toBe(0);
  await repositories.reviews.addEvent(makeEvent({ reviewedAt: at }));
  expect((await analytics.getAnalyticsWindow()).totalReviews).toBe(1);
  const scope = { kind: 'all-decks' } as const;
  const range = { from: calendarDate('2026-09-25'), to: calendarDate('2026-09-25') };
  expect((await analytics.getStudySummary({ scope, range })).dailyActivity).toHaveLength(1);
  expect(await analytics.getCurrentStreak(scope)).toBe(1);
  expect(await analytics.getBestStreak(scope)).toBe(1);
  expect(await analytics.getCardsReviewedToday(scope)).toBe(1);
  expect(await analytics.getRetentionRate(range, scope)).toBe(100);
  expect(await analytics.getBoxDistribution(scope)).toMatchObject({ 1: 1 });
  expect((await analytics.getDailyActivity(range, scope))[0]?.reviewCount).toBe(1);
});
