import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { fixedClock, sequenceIds, makeCard, makeDeck } from '@/../test/fixtures';
import { migrations, runMigrations } from '@/core/database/migrations';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { createApplication } from '@/core/application/create-application';
import { AppError } from '@/core/errors/app-error';
import { SQLiteStudySessionRepository } from '../data/sqlite-study-session-repository';
import { startStudySession } from '../domain/study-session-workflow';
import type { StudyScope } from '../domain/study-session';

const all: StudyScope = { kind: 'all-decks' };
const deckScope: StudyScope = { kind: 'specific-deck', deckId: 'deck-1' };
const databases: RealSqliteDatabase[] = [];
afterEach(() => {
  databases.splice(0).forEach((db) => db.handle.close());
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function setup(version = 9) {
  const db = await RealSqliteDatabase.open();
  databases.push(db);
  for (const migration of migrations.filter((migration) => migration.version <= version)) {
    await db.transaction(async (tx) => {
      for (const sql of migration.statements) await tx.execute(sql);
      await tx.execute(`PRAGMA user_version = ${migration.version}`);
    });
  }
  const repos = createSqliteRepositories(db);
  const ids = sequenceIds();
  const app = createApplication(repos, fixedClock, ids, undefined, undefined, {
    assertAllowed: async () => {},
  });
  await repos.decks.create(makeDeck());
  await repos.decks.create(makeDeck({ id: 'deck-2' }));
  await app.createCard({ ...makeCard(), deckId: 'deck-1' });
  await app.createCard({ ...makeCard(), deckId: 'deck-2' });
  return { db, repos, app, ids };
}
async function count(db: RealSqliteDatabase) {
  return (await db.execute("SELECT id FROM study_sessions WHERE status = 'in-progress'")).rows
    .length;
}
async function cloneSession(db: RealSqliteDatabase, id: string, sourceId: string) {
  await db.execute(
    `INSERT INTO study_sessions
    SELECT ?, scope_json, status, started_at, completed_at, cancelled_at,
      initial_queue_json, retry_queue_json, current_index, retry_successes, workflow_json
    FROM study_sessions WHERE id = ?`,
    [id, sourceId],
  );
}
async function answer(app: ReturnType<typeof createApplication>, id: string) {
  const item = (await app.getCurrentStudyItem(id))!;
  return app.submitStudyAnswer({
    sessionId: id,
    cardId: item.cardId,
    presentationId: item.presentationId,
    result: 'success',
  });
}

test.each([2, 4])(
  '%s concurrent all-decks starts share the first saved session',
  async (requests) => {
    const { db, app } = await setup();
    const sessions = await Promise.all(
      Array.from({ length: requests }, () => app.startStudySession(all)),
    );
    expect(new Set(sessions.map((session) => session.id)).size).toBe(1);
    expect(await count(db)).toBe(1);
  },
);

test('separate application entry points and repository objects share the database invariant', async () => {
  const { db, app, ids } = await setup();
  const second = createApplication(
    createSqliteRepositories(db),
    fixedClock,
    ids,
    undefined,
    undefined,
    { assertAllowed: async () => {} },
  );
  const sessions = await Promise.all([
    app.startStudySession(deckScope),
    second.startStudySession(deckScope),
  ]);
  expect(sessions[0]!.id).toBe(sessions[1]!.id);
  expect(await count(db)).toBe(1);
});

test.each([
  [
    { kind: 'specific-deck', deckId: 'deck-1' },
    { kind: 'specific-deck', deckId: 'deck-2' },
  ],
  [{ kind: 'all-decks' }, { kind: 'specific-deck', deckId: 'deck-1' }],
] as const)(
  'incompatible concurrent scopes preserve exactly one queue: %j / %j',
  async (one, two) => {
    const { db, app } = await setup();
    const results = await Promise.allSettled([
      app.startStudySession(one),
      app.startStudySession(two),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await count(db)).toBe(1);
    const failure = results.find((result) => result.status === 'rejected')!;
    expect(failure.reason).toMatchObject({ code: 'conflict' });
  },
);

test('compatible resumption preserves order, queue and progress; incompatible request remains a conflict', async () => {
  const { app } = await setup();
  const session = await app.startStudySession(all, 'in-order');
  await answer(app, session.id);
  const resumed = await app.startStudySession(all, 'reverse');
  expect(resumed.id).toBe(session.id);
  expect(resumed.currentIndex).toBe(1);
  expect(resumed.initialQueue).toEqual(session.initialQueue);
  await expect(app.startStudySession(deckScope)).rejects.toMatchObject({ code: 'conflict' });
});

test('creation disk failure leaves no session or learning side effects and a retry succeeds', async () => {
  const { db, app, repos } = await setup();
  const states = (await db.execute('SELECT * FROM card_review_state')).rows;
  const outbox = (await db.execute('SELECT * FROM sync_operations')).rows;
  db.failStatement = 'INSERT INTO study_sessions';
  await expect(app.startStudySession(all)).rejects.toMatchObject({ code: 'persistence' });
  expect(await count(db)).toBe(0);
  expect((await db.execute('SELECT * FROM card_review_state')).rows).toEqual(states);
  expect((await db.execute('SELECT * FROM sync_operations')).rows).toEqual(outbox);
  expect(await repos.reviews.listEvents()).toEqual([]);
  db.failStatement = null;
  expect((await app.startStudySession(all)).status).toBe('in-progress');
});

test('raw insert bypassing application guards is atomically rejected and rolls back the whole transaction', async () => {
  const { db, app } = await setup();
  const session = await app.startStudySession(all);
  await expect(
    db.transaction(async (tx) => {
      await tx.execute("UPDATE decks SET name = 'should roll back' WHERE id = 'deck-1'");
      await cloneSession(db, 'duplicate', session.id);
    }),
  ).rejects.toThrow('study_active_session_conflict');
  expect((await app.getDeck('deck-1')).name).not.toBe('should roll back');
  expect(await count(db)).toBe(1);
});

test('raw reactivation cannot create a second active session', async () => {
  const { db, app } = await setup();
  const first = await app.startStudySession(all);
  await app.cancelStudySession(first.id);
  await app.startStudySession(all);
  await expect(
    db.execute("UPDATE study_sessions SET status='in-progress', cancelled_at=NULL WHERE id=?", [
      first.id,
    ]),
  ).rejects.toThrow('study_active_session_conflict');
  expect(await count(db)).toBe(1);
});

test('concurrent direct repositories return a controlled conflict rather than a second active row', async () => {
  const { db, app } = await setup();
  const existing = await app.startStudySession(all);
  await app.cancelStudySession(existing.id);
  const one = new SQLiteStudySessionRepository(db),
    two = new SQLiteStudySessionRepository(db);
  const results = await Promise.allSettled([
    one.create(startStudySession('raw-one', all, existing.initialQueue, existing.startedAt!)),
    two.create(startStudySession('raw-two', all, existing.initialQueue, existing.startedAt!)),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((result) => result.status === 'rejected')).toMatchObject({
    reason: { code: 'conflict' },
  });
  expect(await count(db)).toBe(1);
});

test.each(['cancel', 'complete'] as const)(
  'start overlapping %s is linearized at the active read and never replaces it',
  async (terminal) => {
    const { db, app } = await setup();
    const session = await app.startStudySession(deckScope);
    const entered = deferred(),
      release = deferred();
    const execute = db.execute.bind(db);
    jest.spyOn(db, 'execute').mockImplementationOnce(async (sql, params) => {
      const value = await execute(sql, params);
      entered.resolve();
      await release.promise;
      return value;
    });
    const start = app.startStudySession(deckScope);
    await entered.promise;
    if (terminal === 'cancel') await app.cancelStudySession(session.id);
    else await answer(app, session.id);
    release.resolve();
    expect((await start).id).toBe(session.id);
    expect(await count(db)).toBe(0);
    expect((await app.getStudySession(session.id)).status).toBe(
      terminal === 'cancel' ? 'cancelled' : 'completed',
    );
  },
);

test('cancel winning an answer race leaves state, history and outbox untouched by the rejected answer', async () => {
  const { db, app, repos } = await setup();
  const session = await app.startStudySession(all);
  const before = (await db.execute('SELECT * FROM card_review_state')).rows;
  const entered = deferred(),
    release = deferred();
  const record = repos.studyAnswers!.recordAnswer.bind(repos.studyAnswers);
  jest.spyOn(repos.studyAnswers!, 'recordAnswer').mockImplementationOnce(async (...args) => {
    entered.resolve();
    await release.promise;
    return record(...args);
  });
  const pending = answer(app, session.id);
  const rejection = expect(pending).rejects.toMatchObject({ code: 'conflict' });
  await entered.promise;
  // A second entry point does not share the first use-case's UI/submitting guard.
  const second = createApplication(repos, fixedClock, sequenceIds(), undefined, undefined, {
    assertAllowed: async () => {},
  });
  await second.cancelStudySession(session.id);
  const outbox = (await db.execute('SELECT * FROM sync_operations')).rows;
  release.resolve();
  await rejection;
  expect(await repos.reviews.listEvents()).toEqual([]);
  expect((await db.execute('SELECT * FROM card_review_state')).rows).toEqual(before);
  expect((await db.execute('SELECT * FROM sync_operations')).rows).toEqual(outbox);
  expect((await app.getStudySession(session.id)).status).toBe('cancelled');
});

test('a completed answer wins before cancel without losing its immutable event', async () => {
  const { app, repos } = await setup();
  const session = await app.startStudySession(deckScope);
  await answer(app, session.id);
  await expect(app.cancelStudySession(session.id)).rejects.toMatchObject({ code: 'conflict' });
  expect(await repos.reviews.listEvents()).toHaveLength(1);
  expect((await app.getStudySession(session.id)).status).toBe('completed');
});

test('schema-8 duplicates are preserved verbatim; explicit cancellation selects recovery without losing answers', async () => {
  const { db, app, repos } = await setup(8);
  const session = await app.startStudySession(all);
  await answer(app, session.id);
  await cloneSession(db, 'legacy-hidden', session.id);
  const tables = [
    'study_sessions',
    'review_events',
    'card_review_state',
    'review_replay_baselines',
    'sync_operations',
  ];
  const before = await Promise.all(
    tables.map(async (table) => (await db.execute(`SELECT * FROM ${table}`)).rows),
  );
  expect(await runMigrations(db)).toBe(9);
  for (let index = 0; index < tables.length; index++)
    expect((await db.execute(`SELECT * FROM ${tables[index]}`)).rows).toEqual(before[index]);
  await expect(app.getActiveStudySession()).rejects.toMatchObject({ code: 'conflict' });
  expect((await app.listActiveStudySessions()).map((active) => active.id).sort()).toEqual(
    [session.id, 'legacy-hidden'].sort(),
  );
  await expect(app.startStudySession(all)).rejects.toMatchObject({ code: 'conflict' });
  await expect(cloneSession(db, 'third', session.id)).rejects.toThrow(
    'study_active_session_conflict',
  );
  // Synthetic user explicitly chooses the original session. No migration guesses this choice.
  await app.cancelStudySession('legacy-hidden');
  expect((await app.startStudySession(all)).id).toBe(session.id);
  expect((await app.getStudySession('legacy-hidden')).currentIndex).toBe(1);
  expect(await repos.reviews.listEvents()).toHaveLength(1);
  expect((await repos.reviews.listEvents())[0]!.reviewCalendar).toBeDefined();
});

test('failed/interrupted schema-9 migration rolls back both triggers and version, then retries idempotently', async () => {
  const { db, app } = await setup(8);
  const session = await app.startStudySession(all);
  db.failStatement = 'CREATE TRIGGER study_single_active_update';
  await expect(runMigrations(db)).rejects.toThrow('Disk full');
  expect((await db.execute('PRAGMA user_version')).rows[0]?.user_version).toBe(8);
  expect(
    (await db.execute("SELECT name FROM sqlite_master WHERE name LIKE 'study_single_active_%'"))
      .rows,
  ).toHaveLength(0);
  expect((await app.getStudySession(session.id)).status).toBe('in-progress');
  db.failStatement = null;
  const reopened = await RealSqliteDatabase.open(db.handle.export());
  databases.push(reopened);
  expect(await runMigrations(reopened)).toBe(9);
  expect(await runMigrations(reopened)).toBe(9);
  expect((await new SQLiteStudySessionRepository(reopened).getActive())?.id).toBe(session.id);
});

test.each([0, 1])(
  'schema-8 upgrade with %s active sessions preserves terminal history',
  async (activeCount) => {
    const { db, app } = await setup(8);
    const first = await app.startStudySession(all);
    await app.cancelStudySession(first.id);
    if (activeCount) await app.startStudySession(all);
    const rows = (await db.execute('SELECT * FROM study_sessions')).rows;
    await runMigrations(db);
    expect((await db.execute('SELECT * FROM study_sessions')).rows).toEqual(rows);
    expect(await count(db)).toBe(activeCount);
  },
);

test('fresh installation and restart preserve the active identity, answered cards and history', async () => {
  const { db, app } = await setup();
  const session = await app.startStudySession(all);
  await answer(app, session.id);
  const reopened = await RealSqliteDatabase.open(db.handle.export());
  databases.push(reopened);
  await runMigrations(reopened);
  const repos = createSqliteRepositories(reopened);
  const restarted = createApplication(repos, fixedClock, sequenceIds(), undefined, undefined, {
    assertAllowed: async () => {},
  });
  expect(await restarted.startStudySession(all)).toMatchObject({ id: session.id, currentIndex: 1 });
  expect(await repos.reviews.listEvents()).toHaveLength(1);
});

test('owner switch while building the queue prevents creation; a different owner can study independently', async () => {
  const guest = await setup(),
    account = await setup();
  let current = true;
  const guarded = createApplication(
    guest.repos,
    fixedClock,
    guest.ids,
    undefined,
    undefined,
    { assertAllowed: async () => {} },
    () => {
      if (!current) throw new AppError('unavailable', 'Owner changed');
    },
  );
  const entered = deferred(),
    release = deferred();
  const list = guest.repos.cards.listByDeck.bind(guest.repos.cards);
  jest.spyOn(guest.repos.cards, 'listByDeck').mockImplementationOnce(async (id) => {
    entered.resolve();
    await release.promise;
    return list(id);
  });
  const pending = guarded.startStudySession(deckScope);
  const rejection = expect(pending).rejects.toMatchObject({ code: 'unavailable' });
  await entered.promise;
  current = false;
  await account.app.startStudySession(all);
  release.resolve();
  await rejection;
  expect(await count(guest.db)).toBe(0);
  expect(await count(account.db)).toBe(1);
});
