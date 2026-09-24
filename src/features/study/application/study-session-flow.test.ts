import { calendarDate, instant } from '@/core/domain/values';
import { createApplication } from '@/core/application/create-application';
import {
  makeCard,
  makeDeck,
  makeRepositories,
  makeState,
  fixedClock,
  sequenceIds,
  timestamp,
} from '@/../test/fixtures';
import type { StudyScope } from '../domain/study-session';

const all: StudyScope = { kind: 'all-decks' };
const deckScope: StudyScope = { kind: 'specific-deck', deckId: 'deck-1' };

async function setup(ids: readonly string[], decks: readonly string[] = ['deck-1']) {
  const repos = makeRepositories();
  for (const id of decks) await repos.decks.create(makeDeck({ id }));
  for (const id of ids) {
    const deckId = decks[0]!;
    await repos.cards.create(makeCard({ id, deckId }));
    await repos.reviews.saveState(makeState({ cardId: id }));
  }
  return { repos, app: createApplication(repos, fixedClock, sequenceIds()) };
}

async function answer(
  app: ReturnType<typeof createApplication>,
  sessionId: string,
  result: 'success' | 'failure',
) {
  const item = await app.getCurrentStudyItem(sessionId);
  if (!item) throw new Error('Expected a current presentation');
  return app.submitStudyAnswer({
    sessionId,
    cardId: item.cardId,
    presentationId: item.presentationId,
    result,
  });
}

test('session starts at the first snapshot item, reports progress and prevents a second active session', async () => {
  const { app } = await setup(['B', 'A']);
  const session = await app.startStudySession(deckScope);
  expect(session).toMatchObject({
    scope: deckScope,
    status: 'in-progress',
    startedAt: timestamp,
    completedAt: null,
    currentIndex: 0,
    retryQueue: [],
  });
  expect(session.initialQueue.map((item) => item.cardId)).toEqual(['A', 'B']);
  expect(await app.getCurrentStudyItem(session.id)).toMatchObject({
    cardId: 'A',
    kind: 'initial',
    presentationId: `${session.id}:0`,
  });
  expect(await app.getStudyProgress(session.id)).toMatchObject({
    currentPosition: 1,
    initialQueueSize: 2,
    completed: 0,
    remaining: 2,
    failures: 0,
    retries: 0,
    isComplete: false,
    durationMs: null,
  });
  await expect(app.startStudySession(all)).rejects.toMatchObject({ code: 'conflict' });
  const first = await answer(app, session.id, 'success');
  expect(first.progress).toMatchObject({ currentPosition: 2, completed: 1, remaining: 1 });
  expect(first.currentItem?.cardId).toBe('B');
  expect(session.currentIndex).toBe(0);
});

test('empty queue yields a completed zero-work session and does not block later study', async () => {
  const { app } = await setup([]);
  const empty = await app.startStudySession(deckScope);
  expect(empty).toMatchObject({
    status: 'completed',
    initialQueue: [],
    retryQueue: [],
    currentIndex: 0,
    completedAt: timestamp,
  });
  expect(await app.getCurrentStudyItem(empty.id)).toBeNull();
  expect(await app.getStudyProgress(empty.id)).toMatchObject({
    currentPosition: null,
    initialQueueSize: 0,
    isComplete: true,
    totalPresentations: 0,
    durationMs: 0,
  });
  await expect(
    app.submitStudyAnswer({
      sessionId: empty.id,
      cardId: 'none',
      presentationId: `${empty.id}:0`,
      result: 'success',
    }),
  ).rejects.toMatchObject({ code: 'conflict' });
  await expect(app.cancelStudySession(empty.id)).rejects.toMatchObject({ code: 'conflict' });
  expect((await app.startStudySession(all)).status).toBe('completed');
});

test('failed cards A and C retry in first-failure order after the initial queue', async () => {
  const { app, repos } = await setup(['A', 'B', 'C']);
  const session = await app.startStudySession(all);
  const seen: string[] = [];
  const steps = [
    ['A', 'failure'],
    ['B', 'success'],
    ['C', 'failure'],
    ['A', 'success'],
    ['C', 'success'],
  ] as const;
  for (const [expected, result] of steps) {
    seen.push((await app.getCurrentStudyItem(session.id))!.cardId);
    expect(seen.at(-1)).toBe(expected);
    await answer(app, session.id, result);
  }
  expect(seen).toEqual(['A', 'B', 'C', 'A', 'C']);
  expect((await app.getStudySession(session.id)).status).toBe('completed');
  expect(await app.getCurrentStudyItem(session.id)).toBeNull();
  expect(await app.getStudyProgress(session.id)).toMatchObject({
    totalPresentations: 5,
    uniqueCardsStudied: 3,
    successfulInitialAnswers: 1,
    failedInitialAnswers: 2,
    retryCount: 2,
    finalSuccessCount: 3,
    failures: 2,
    retries: 2,
    completed: 5,
    remaining: 0,
    isComplete: true,
  });
  expect(await repos.reviews.listEvents({ cardId: 'A' })).toHaveLength(2);
  expect(await repos.reviews.listEvents({ cardId: 'C' })).toHaveLength(2);
  expect(
    (await repos.reviews.listEvents({ deckId: 'deck-1' })).every(
      (event) => event.studySessionId === session.id,
    ),
  ).toBe(true);
});

test('mixed five-card workload produces A B C D E B D and deterministic completion totals', async () => {
  const { app } = await setup(['E', 'C', 'B', 'D', 'A']);
  const session = await app.startStudySession(all);
  const expected = [
    ['A', 'success'],
    ['B', 'failure'],
    ['C', 'success'],
    ['D', 'failure'],
    ['E', 'success'],
    ['B', 'failure'],
    ['D', 'success'],
  ] as const;
  const kinds: string[] = [];
  for (const [id, result] of expected) {
    const item = await app.getCurrentStudyItem(session.id);
    expect(item?.cardId).toBe(id);
    kinds.push(item!.kind);
    await answer(app, session.id, result);
  }
  expect(kinds).toEqual(['initial', 'initial', 'initial', 'initial', 'initial', 'retry', 'retry']);
  const completed = await app.getStudySession(session.id);
  expect(completed).toMatchObject({ status: 'completed', currentIndex: 7, completedAt: timestamp });
  expect(await app.getStudyProgress(session.id)).toMatchObject({
    initialQueueSize: 5,
    totalPresentations: 7,
    uniqueCardsStudied: 5,
    successfulInitialAnswers: 3,
    failedInitialAnswers: 2,
    retryCount: 2,
    finalSuccessCount: 4,
    failures: 3,
    completed: 7,
    remaining: 0,
    durationMs: 0,
  });
});

test('one-card failure and failed retry complete after exactly two reviews', async () => {
  const { app, repos } = await setup(['A']);
  const session = await app.startStudySession(deckScope);
  const initial = (await app.getCurrentStudyItem(session.id))!;
  const first = await answer(app, session.id, 'failure');
  expect(first.currentItem).toMatchObject({ cardId: 'A', kind: 'retry' });
  expect(first.currentItem?.presentationId).not.toBe(initial.presentationId);
  expect(first.review.updatedReviewState).toMatchObject({ box: 1, dueDate: '2026-09-24' });
  await expect(
    app.submitStudyAnswer({
      sessionId: session.id,
      cardId: 'A',
      presentationId: initial.presentationId,
      result: 'failure',
    }),
  ).rejects.toMatchObject({ code: 'conflict' });
  const second = await answer(app, session.id, 'failure');
  expect(second.session).toMatchObject({ status: 'completed', retryQueue: [{ cardId: 'A' }] });
  expect(second.progress).toMatchObject({ completed: 2, failures: 2, retries: 1, remaining: 0 });
  expect((await repos.reviews.listEvents({ cardId: 'A' })).map((event) => event.result)).toEqual([
    'failure',
    'failure',
  ]);
  await expect(
    app.submitStudyAnswer({
      sessionId: session.id,
      cardId: 'A',
      presentationId: first.currentItem!.presentationId,
      result: 'success',
    }),
  ).rejects.toMatchObject({ code: 'conflict' });
  expect(await repos.reviews.listEvents({ cardId: 'A' })).toHaveLength(2);
  const nextSession = await app.startStudySession(all);
  expect(nextSession.initialQueue.map((item) => item.cardId)).toEqual(['A']);
});

test.each([
  [1, 2, '2026-09-26'],
  [2, 3, '2026-09-28'],
  [3, 4, '2026-10-02'],
  [4, 5, '2026-10-10'],
  [5, 5, '2026-10-10'],
] as const)(
  'success from Box %i delegates promotion to Box %i and due date %s to ReviewCard',
  async (box, nextBox, due) => {
    const { app, repos } = await setup(['A']);
    await repos.reviews.saveState(
      makeState({
        cardId: 'A',
        box,
        totalReviews: box - 1,
        totalSuccesses: box - 1,
        consecutiveSuccesses: box - 1,
      }),
    );
    const session = await app.startStudySession(all);
    const result = await answer(app, session.id, 'success');
    expect(result.review).toMatchObject({ newBox: nextBox, newDueDate: due });
    expect(result.session.status).toBe('completed');
    expect(result.session.retryQueue).toEqual([]);
    expect((await repos.reviews.getState('A'))?.box).toBe(nextBox);
    expect(await repos.reviews.listEvents({ cardId: 'A' })).toHaveLength(1);
  },
);

test('wrong card, stale token and invalid result never review another card', async () => {
  const { app, repos } = await setup(['A', 'B']);
  const session = await app.startStudySession(all);
  const current = (await app.getCurrentStudyItem(session.id))!;
  const request = {
    sessionId: session.id,
    presentationId: current.presentationId,
    result: 'success' as const,
  };
  await expect(app.submitStudyAnswer({ ...request, cardId: 'B' })).rejects.toMatchObject({
    code: 'validation',
  });
  await expect(
    app.submitStudyAnswer({ ...request, cardId: 'A', presentationId: 'stale' }),
  ).rejects.toMatchObject({ code: 'conflict' });
  await expect(
    app.submitStudyAnswer({ ...request, cardId: 'A', result: 'again' as never }),
  ).rejects.toMatchObject({ code: 'validation' });
  expect(await repos.reviews.listEvents()).toEqual([]);
  expect(await app.getCurrentStudyItem(session.id)).toEqual(current);
  await answer(app, session.id, 'success');
  await expect(app.submitStudyAnswer({ ...request, cardId: 'A' })).rejects.toMatchObject({
    code: 'conflict',
  });
  expect(await repos.reviews.listEvents({ cardId: 'A' })).toHaveLength(1);
});

test('simultaneous double submission advances one presentation and records one event', async () => {
  const { app, repos } = await setup(['A', 'B']);
  const session = await app.startStudySession(all);
  const current = (await app.getCurrentStudyItem(session.id))!;
  const input = {
    sessionId: session.id,
    cardId: current.cardId,
    presentationId: current.presentationId,
  };
  const first = app.submitStudyAnswer({ ...input, result: 'success' });
  await expect(app.submitStudyAnswer({ ...input, result: 'failure' })).rejects.toMatchObject({
    code: 'conflict',
  });
  expect((await first).session.currentIndex).toBe(1);
  expect(await repos.reviews.listEvents({ cardId: 'A' })).toHaveLength(1);
  expect((await repos.reviews.getState('A'))?.totalReviews).toBe(1);
  await expect(app.submitStudyAnswer({ ...input, result: 'success' })).rejects.toMatchObject({
    code: 'conflict',
  });
  expect((await app.getStudySession(session.id)).currentIndex).toBe(1);
});

test('cancel retains completed reviews, leaves remaining cards untouched, and permits a new session', async () => {
  const { app, repos } = await setup(['A', 'B']);
  const session = await app.startStudySession(all);
  await answer(app, session.id, 'success');
  const cancelled = await app.cancelStudySession(session.id);
  expect(cancelled).toMatchObject({
    status: 'cancelled',
    currentIndex: 1,
    cancelledAt: timestamp,
    completedAt: null,
  });
  expect(await app.getCurrentStudyItem(session.id)).toBeNull();
  expect((await app.getStudyProgress(session.id)).durationMs).toBe(0);
  expect((await repos.reviews.getState('A'))?.totalReviews).toBe(1);
  expect((await repos.reviews.getState('B'))?.totalReviews).toBe(0);
  expect(await repos.reviews.listEvents()).toHaveLength(1);
  await expect(app.cancelStudySession(session.id)).rejects.toMatchObject({ code: 'conflict' });
  await expect(
    app.submitStudyAnswer({
      sessionId: session.id,
      cardId: 'B',
      presentationId: `${session.id}:1`,
      result: 'success',
    }),
  ).rejects.toMatchObject({ code: 'conflict' });
  const next = await app.startStudySession(all);
  expect(next.initialQueue.map((item) => item.cardId)).toEqual(['B']);
});

test('newly due external cards do not alter an active session snapshot', async () => {
  const { app, repos } = await setup(['A', 'B']);
  const session = await app.startStudySession(all);
  await app.createCard({
    deckId: 'deck-1',
    frontText: 'new',
    meaning: 'new',
    phonetic: null,
    category: null,
    examples: [],
  });
  await repos.reviews.saveState(makeState({ cardId: 'B', dueDate: calendarDate('2026-09-20') }));
  expect((await app.getStudySession(session.id)).initialQueue.map((item) => item.cardId)).toEqual([
    'A',
    'B',
  ]);
  await answer(app, session.id, 'success');
  expect((await app.getCurrentStudyItem(session.id))?.cardId).toBe('B');
  await answer(app, session.id, 'success');
  expect((await app.getStudySession(session.id)).status).toBe('completed');
  expect(await repos.reviews.listEvents()).toHaveLength(2);
});

test('session duration uses review instants and cannot precede the session start', async () => {
  const repos = makeRepositories();
  await repos.decks.create(makeDeck());
  await repos.cards.create(makeCard({ id: 'A' }));
  await repos.reviews.saveState(makeState({ cardId: 'A' }));
  let clockInstant = timestamp;
  const app = createApplication(
    repos,
    {
      now: () => new Date(clockInstant),
      timeZone: () => 'UTC',
    },
    sequenceIds(),
  );
  const session = await app.startStudySession(all);
  clockInstant = instant('2026-09-24T10:05:00.000Z');
  await answer(app, session.id, 'success');
  expect((await app.getStudyProgress(session.id)).durationMs).toBe(300000);
  expect((await app.getStudySession(session.id)).completedAt).toBe(clockInstant);
});

test('session start interprets due dates using the injected current local time zone', async () => {
  const repos = makeRepositories();
  await repos.decks.create(makeDeck());
  await repos.cards.create(makeCard({ id: 'A' }));
  await repos.reviews.saveState(
    makeState({
      cardId: 'A',
      dueDate: calendarDate('2026-09-25'),
    }),
  );
  const app = createApplication(
    repos,
    {
      now: () => new Date('2026-09-24T23:30:00.000Z'),
      timeZone: () => 'Asia/Tehran',
    },
    sequenceIds(),
  );
  expect(await app.getStudyQueue({ scope: all, targetDate: calendarDate('2026-09-24') })).toEqual(
    [],
  );
  expect((await app.startStudySession(all)).initialQueue.map((item) => item.cardId)).toEqual(['A']);
});

test('two simultaneous starts cannot replace the same active session', async () => {
  const { app, repos } = await setup(['A']);
  const settled = await Promise.allSettled([
    app.startStudySession(all),
    app.startStudySession(all),
  ]);
  expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(settled.filter((result) => result.status === 'rejected')).toHaveLength(1);
  expect((await repos.sessions.getActive())?.status).toBe('in-progress');
});

test('review failure leaves the session at the current presentation and can be retried', async () => {
  const { app, repos } = await setup(['A']);
  const session = await app.startStudySession(all);
  const current = (await app.getCurrentStudyItem(session.id))!;
  const record = jest
    .spyOn(repos.reviews, 'record')
    .mockRejectedValueOnce(new Error('private storage error'));
  await expect(
    app.submitStudyAnswer({
      sessionId: session.id,
      cardId: current.cardId,
      presentationId: current.presentationId,
      result: 'success',
    }),
  ).rejects.toMatchObject({ code: 'persistence' });
  expect(await app.getCurrentStudyItem(session.id)).toEqual(current);
  expect(await repos.reviews.listEvents()).toEqual([]);
  record.mockRestore();
  expect((await answer(app, session.id, 'success')).session.status).toBe('completed');
});

test('unknown session and wrong deck scope fail cleanly without creating events', async () => {
  const { app, repos } = await setup(['A'], ['deck-1', 'deck-2']);
  await expect(app.getStudySession('missing')).rejects.toMatchObject({ code: 'not-found' });
  await expect(
    app.startStudySession({ kind: 'specific-deck', deckId: 'missing' }),
  ).rejects.toMatchObject({ code: 'not-found' });
  await expect(app.startStudySession({ kind: 'unsupported' } as never)).rejects.toMatchObject({
    code: 'validation',
  });
  const scoped = await app.startStudySession({ kind: 'specific-deck', deckId: 'deck-2' });
  expect(scoped.status).toBe('completed');
  expect(await repos.reviews.listEvents()).toEqual([]);
});
