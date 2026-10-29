import { createApplication } from '@/core/application/create-application';
import { calendarDate } from '@/core/domain/values';
import {
  fixedClock,
  makeCard,
  makeDeck,
  makeRepositories,
  makeState,
  sequenceIds,
} from '@/../test/fixtures';
import { orderStudyQueue } from '../domain/study-order';
import { installFreeTierGuards } from '@/core/database/free-tier-guards';
import { runMigrations } from '@/core/database/migrations';
import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';

const scope = { kind: 'all-decks' as const };
const today = calendarDate('2026-09-24');
afterEach(() => jest.restoreAllMocks());

async function setup() {
  const repositories = makeRepositories();
  await repositories.decks.create(makeDeck());
  for (const id of ['C', 'A', 'B', 'future']) {
    await repositories.cards.create(makeCard({ id }));
    await repositories.reviews.saveState(
      makeState({
        cardId: id,
        dueDate: id === 'future' ? calendarDate('2026-09-25') : today,
      }),
    );
  }
  const app = createApplication(repositories, fixedClock, sequenceIds());
  return { app, repositories };
}

test.each([
  ['in-order', ['A', 'B', 'C']],
  ['reverse', ['C', 'B', 'A']],
  ['random', ['B', 'C', 'A']],
] as const)(
  '%s orders only the due cards and keeps the saved queue stable',
  async (order, expected) => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { app } = await setup();
    const session = await app.startStudySession(scope, order);
    expect(session.initialQueue.map((item) => item.cardId)).toEqual(expected);
    expect(
      (await app.getStudyQueue({ scope, targetDate: today })).map((item) => item.cardId),
    ).toEqual(['A', 'B', 'C']);
    const item = (await app.getCurrentStudyItem(session.id))!;
    await app.submitStudyAnswer({
      sessionId: session.id,
      cardId: item.cardId,
      presentationId: item.presentationId,
      result: 'failure',
    });
    expect((await app.getStudySession(session.id)).initialQueue).toEqual(session.initialQueue);
    expect((await app.getCurrentStudyItem(session.id))?.cardId).toBe(expected[1]);
  },
);

test('new sessions and review-again sessions default to random', async () => {
  const random = jest.spyOn(Math, 'random').mockReturnValue(0);
  const { app } = await setup();
  const session = await app.startStudySession(scope);
  expect(session.initialQueue.map((item) => item.cardId)).toEqual(['B', 'C', 'A']);
  while ((await app.getStudySession(session.id)).status === 'in-progress') {
    const item = (await app.getCurrentStudyItem(session.id))!;
    await app.submitStudyAnswer({
      sessionId: session.id,
      cardId: item.cardId,
      presentationId: item.presentationId,
      result: item.kind === 'initial' ? 'failure' : 'success',
    });
  }
  random.mockClear();
  const retry = await app.reviewMissedCards(session.id);
  expect(retry.initialQueue.map((item) => item.cardId)).toEqual(['B', 'C', 'A']);
  expect(random).toHaveBeenCalledTimes(2);
  expect(retry.sourceSessionId).toBe(session.id);
});

test.each(['in-order', 'reverse'] as const)(
  'reviewing missed cards also accepts %s',
  async (order) => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { app } = await setup();
    const session = await app.startStudySession(scope, 'random');
    while ((await app.getStudySession(session.id)).status === 'in-progress') {
      const item = (await app.getCurrentStudyItem(session.id))!;
      await app.submitStudyAnswer({
        sessionId: session.id,
        cardId: item.cardId,
        presentationId: item.presentationId,
        result: item.kind === 'initial' ? 'failure' : 'success',
      });
    }
    const retry = await app.reviewMissedCards(session.id, order);
    expect(retry.initialQueue.map((item) => item.cardId)).toEqual(
      order === 'reverse' ? ['C', 'B', 'A'] : ['A', 'B', 'C'],
    );
  },
);

test('ordering never mutates the input or loses cards, and invalid choices are rejected', () => {
  const queue = ['A', 'B', 'C'].map((cardId) => ({ cardId, deckId: 'deck-1', dueDate: today }));
  const original = [...queue];
  expect(orderStudyQueue(queue, 'reverse', () => 0).map((item) => item.cardId)).toEqual([
    'C',
    'B',
    'A',
  ]);
  expect(new Set(orderStudyQueue(queue, 'random', () => 0))).toEqual(new Set(queue));
  expect(queue).toEqual(original);
  expect(() => orderStudyQueue(queue, 'unknown' as 'random', () => 0)).toThrow(
    'Invalid study order',
  );
});

test('SQLite resumes the selected queue after an offline application restart', async () => {
  const database = await RealSqliteDatabase.open();
  await runMigrations(database);
  await installFreeTierGuards(database);
  const repositories = createSqliteRepositories(database);
  await repositories.decks.create(makeDeck());
  for (const id of ['A', 'B', 'C']) {
    await repositories.cards.create(makeCard({ id }));
    await repositories.reviews.saveState(makeState({ cardId: id }));
  }
  const app = createApplication(repositories, fixedClock, sequenceIds());
  const session = await app.startStudySession(scope, 'reverse');
  const item = (await app.getCurrentStudyItem(session.id))!;
  await app.submitStudyAnswer({
    sessionId: session.id,
    cardId: item.cardId,
    presentationId: item.presentationId,
    result: 'success',
  });
  const reopened = await RealSqliteDatabase.open(database.handle.export());
  const restored = createApplication(createSqliteRepositories(reopened), fixedClock, sequenceIds());
  expect(
    (await restored.getStudySession(session.id)).initialQueue.map((card) => card.cardId),
  ).toEqual(['C', 'B', 'A']);
  expect((await restored.getCurrentStudyItem(session.id))?.cardId).toBe('B');
  database.handle.close();
  reopened.handle.close();
});
