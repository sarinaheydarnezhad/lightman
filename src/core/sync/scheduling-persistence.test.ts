import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { fixedClock, sequenceIds, makeCard, makeDeck } from '@/../test/fixtures';
import { migrations, runMigrations } from '@/core/database/migrations';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { createApplication } from '@/core/application/create-application';
import type { ServerChange } from './contract';
import { SyncStore } from './sync-store';
import { calendarDate, instant } from '@/core/domain/values';

const time = '2026-11-12T21:30:00.000Z';
const change = (
  entityType: ServerChange['entityType'],
  entityId: string,
  serverVersion: number,
  payload: Record<string, unknown>,
): ServerChange => ({
  entityType,
  entityId,
  serverVersion,
  operation: entityType === 'reviewEvent' ? 'create' : 'upsert',
  payload,
  deviceId: 'remote',
  clientChangeId: 'op-' + serverVersion,
  clientChangedAtUtc: time,
});
const seed = {
  box: 4,
  dueDate: '2026-11-13',
  lastReviewedAtUtc: '2026-11-12T08:00:00.000Z',
  totalReviews: 9,
  totalSuccesses: 8,
  consecutiveSuccesses: 3,
};

test('pull does not reapply an obsolete acknowledged scheduler before its later offline edit', async () => {
  const db = await RealSqliteDatabase.open();
  try {
    await runMigrations(db);
    const repos = createSqliteRepositories(db);
    const app = createApplication(repos, fixedClock, sequenceIds());
    const deck = await app.createDeck(makeDeck());
    await app.updateDeck(deck.id, { reviewSystem: 'sm2' });
    const card = await app.createCard({ ...makeCard(), deckId: deck.id });
    const store = new SyncStore(db);
    const operations = (await store.pending()).filter((o) => o.entityType === 'deck');
    for (let i = 0; i < operations.length; i++) await store.acknowledge(operations[i]!, i + 1);
    await store.applyPage({
      cursor: 2,
      latestVersion: 2,
      hasMore: false,
      changes: [
        {
          ...change('deck', deck.id, 1, { ...deck, reviewSystem: 'leitner' }),
          clientChangeId: operations[0]!.operationId,
        },
        {
          ...change('deck', deck.id, 2, { ...deck, reviewSystem: 'sm2' }),
          clientChangeId: operations[1]!.operationId,
        },
      ],
    });
    expect((await repos.decks.getById(deck.id))!.reviewSystem).toBe('sm2');
    expect((await repos.reviews.getState(card.id))!.schedulerState!.schedulerId).toBe('sm2');
  } finally {
    db.handle.close();
  }
});

test('legacy local calendar stays stable across different checkpoint watermarks, without inventing metadata', async () => {
  const db = await RealSqliteDatabase.open();
  try {
    await runMigrations(db);
    const repos = createSqliteRepositories(db);
    const app = createApplication(repos, fixedClock, sequenceIds());
    const deck = await app.createDeck(makeDeck());
    const card = await app.createCard({ ...makeCard(), deckId: deck.id });
    await repos.reviews.saveState({
      cardId: card.id,
      box: 4,
      dueDate: calendarDate('2026-11-15'),
      lastReviewedAt: instant(seed.lastReviewedAtUtc),
      updatedAt: instant(time),
      totalReviews: 9,
      totalSuccesses: 8,
      consecutiveSuccesses: 3,
    });
    // Mimic the explicit local baseline captured by migration 8.
    const state = await repos.reviews.getState(card.id);
    await db.execute(
      'INSERT INTO review_replay_baselines (card_id,through_version,state_json,included_event_ids_json) VALUES (?,0,?,?)',
      [card.id, JSON.stringify(state), '[]'],
    );
    const store = new SyncStore(db);
    for (const version of [1, 2]) {
      await store.applyPage({
        cursor: version,
        latestVersion: version,
        hasMore: false,
        changes: [change('deck', deck.id, version, { ...deck })],
        reviewCheckpoints: [{ cardId: card.id, throughVersion: version, state: seed }],
      });
      expect((await repos.reviews.getState(card.id))!.dueDate).toBe('2026-11-15');
      expect((await repos.reviews.getState(card.id))!.totalReviews).toBe(9);
    }
    await expect(
      store.applyPage({
        cursor: 3,
        latestVersion: 3,
        hasMore: false,
        changes: [change('deck', deck.id, 3, { ...deck })],
        reviewCheckpoints: [
          { cardId: card.id, throughVersion: 3, state: { ...seed, totalSuccesses: 7 } },
        ],
      }),
    ).rejects.toThrow('Incomplete review baseline');
    expect((await repos.reviews.getState(card.id))!.totalSuccesses).toBe(8);
  } finally {
    db.handle.close();
  }
});

test.each(['leitner', 'sm2'])(
  'offline empty %s deck edits retain explicit scheduler selection and reject stale card state atomically',
  async (from) => {
    const db = await RealSqliteDatabase.open();
    try {
      await runMigrations(db);
      const repos = createSqliteRepositories(db);
      const app = createApplication(repos, fixedClock, sequenceIds());
      const deck = await app.createDeck(makeDeck({ reviewSystem: from }));
      const to = from === 'leitner' ? 'sm2' : 'leitner';
      await app.updateDeck(deck.id, { reviewSystem: to });
      const changes = (await new SyncStore(db).pending()).filter((o) => o.entityType === 'deck');
      expect(changes.map((o) => (o.payload as { reviewSystem: string }).reviewSystem)).toEqual([
        from,
        to,
      ]);
      await expect(
        db.transaction(async (tx) => {
          await tx.execute(
            "INSERT INTO cards (id,deck_id,front_text,meaning,examples_json,created_at,updated_at) VALUES ('stale',?,'term','meaning','[]',?,?)",
            [deck.id, time, time],
          );
          await tx.execute(
            "INSERT INTO card_review_state (card_id,box,due_date,updated_at,scheduler_state_json) VALUES ('stale',1,'2026-11-13',?,?)",
            [
              time,
              from === 'sm2'
                ? JSON.stringify({
                    schedulerId: 'sm2',
                    key: 'new',
                    data: { repetitions: 0, intervalDays: 0, easeFactor: 2.5 },
                  })
                : null,
            ],
          );
        }),
      ).rejects.toThrow('scheduler_change_ineligible');
      expect(await repos.cards.getById('stale')).toBeNull();
      const card = await app.createCard({ ...makeCard(), deckId: deck.id });
      await expect(app.updateDeck(deck.id, { reviewSystem: from })).rejects.toMatchObject({
        code: 'conflict',
      });
      expect(
        (await repos.reviews.getState(card.id))!.schedulerState?.schedulerId ?? 'leitner',
      ).toBe(to);
    } finally {
      db.handle.close();
    }
  },
);

test.each(['leitner', 'sm2'])(
  'fresh %s install uses an explicit checkpoint before replaying history',
  async (system) => {
    const db = await RealSqliteDatabase.open();
    try {
      await runMigrations(db);
      const store = new SyncStore(db);
      const projection = {
        ...seed,
        box: system === 'leitner' ? 5 : 1,
        totalReviews: 10,
        totalSuccesses: 9,
        consecutiveSuccesses: 4,
        dueDate: '2026-11-15',
        ...(system === 'sm2'
          ? {
              schedulerState: {
                schedulerId: 'sm2',
                key: 'review',
                data: { repetitions: 4, intervalDays: 20, easeFactor: 2.9 },
              },
            }
          : {}),
      };
      const checkpoint = { cardId: 'card', throughVersion: 4, state: projection };
      await store.applyPage({
        cursor: 2,
        latestVersion: 4,
        hasMore: true,
        reviewCheckpoints: [checkpoint],
        changes: [
          change('deck', 'deck', 1, {
            name: 'Baseline',
            description: '',
            language: 'en',
            textAlignment: 'ltr',
            typographySize: 'medium',
            reviewSystem: system,
          }),
          change('card', 'card', 2, {
            deckId: 'deck',
            frontText: 'term',
            meaning: 'meaning',
            examples: [],
            phonetic: null,
            category: null,
          }),
        ],
      });
      await store.applyPage({
        cursor: 4,
        latestVersion: 4,
        hasMore: false,
        reviewCheckpoints: [checkpoint],
        changes: [
          change('reviewState', 'card', 3, { ...seed, box: system === 'leitner' ? 4 : 1 }),
          change('reviewEvent', 'event', 4, {
            cardId: 'card',
            deckId: 'deck',
            previousBox: 4,
            newBox: system === 'leitner' ? 5 : 1,
            result: 'success',
            reviewedAtUtc: time,
            studySessionId: null,
            reviewCalendar: { reviewDate: '2026-11-13', utcOffsetMinutes: 210 },
            ...(system === 'sm2'
              ? { scheduler: { schedulerId: 'sm2', previousState: 'review', newState: 'review' } }
              : {}),
          }),
        ],
      });
      const repository = createSqliteRepositories(db).reviews;
      expect(await repository.getState('card')).toMatchObject({
        totalReviews: 10,
        totalSuccesses: 9,
        dueDate: '2026-11-15',
      });
      const original = (await db.execute('SELECT * FROM review_events')).rows;
      await store.applyPage({
        cursor: 4,
        latestVersion: 4,
        hasMore: false,
        reviewCheckpoints: [checkpoint],
        changes: [],
      });
      expect((await repository.getState('card'))!.totalReviews).toBe(10);
      expect((await db.execute('SELECT * FROM review_events')).rows).toEqual(original);
      await expect(
        store.applyPage({
          cursor: 4,
          latestVersion: 4,
          hasMore: false,
          changes: [],
          reviewCheckpoints: [{ ...checkpoint, state: { ...projection, totalReviews: 11 } }],
        }),
      ).rejects.toThrow('Conflicting review checkpoints');
      expect((await repository.getState('card'))!.totalReviews).toBe(10);
    } finally {
      db.handle.close();
    }
  },
);

test('new review calendar persists with the same immutable outbox payload', async () => {
  const db = await RealSqliteDatabase.open();
  try {
    await runMigrations(db);
    const repos = createSqliteRepositories(db);
    const app = createApplication(
      repos,
      { now: () => new Date(time), timeZone: () => 'Asia/Tehran' },
      sequenceIds(),
    );
    const deck = await app.createDeck(makeDeck());
    const card = await app.createCard({ ...makeCard(), deckId: deck.id });
    await app.reviewCard({
      cardId: card.id,
      deckId: deck.id,
      result: 'success',
      studySessionId: null,
    });
    const event = (await repos.reviews.listEvents())[0]!;
    expect(event.reviewedAt).toBe(time);
    expect(event.reviewCalendar).toEqual({ reviewDate: '2026-11-13', utcOffsetMinutes: 210 });
    const outbox = (await new SyncStore(db).pending()).find(
      (op) => op.entityType === 'reviewEvent',
    )!;
    expect(outbox.payload).toMatchObject({
      reviewedAtUtc: time,
      reviewCalendar: event.reviewCalendar,
    });
    expect((await repos.reviews.getState(card.id))!.dueDate).toBe('2026-11-15');
  } finally {
    db.handle.close();
  }
});

test('migration 8 preserves legacy rows, queues and proven baseline IDs; interruption rolls back', async () => {
  const db = await RealSqliteDatabase.open();
  try {
    for (const migration of migrations.filter((m) => m.version <= 7))
      await db.transaction(async (tx) => {
        for (const sql of migration.statements) await tx.execute(sql);
        await tx.execute(`PRAGMA user_version=${migration.version}`);
      });
    await db.execute(
      "INSERT INTO decks (id,name,description,language,text_alignment,typography_size,review_system,created_at,updated_at) VALUES ('d','Legacy','','en','ltr','medium','leitner',?,?)",
      [time, time],
    );
    await db.execute(
      "INSERT INTO cards (id,deck_id,front_text,meaning,examples_json,created_at,updated_at) VALUES ('c','d','term','meaning','[]',?,?)",
      [time, time],
    );
    await db.execute(
      "INSERT INTO card_review_state (card_id,box,due_date,last_reviewed_at,consecutive_successes,total_reviews,total_successes,updated_at) VALUES ('c',4,'2026-11-15',?,3,9,8,?)",
      [time, time],
    );
    await db.execute(
      "INSERT INTO review_events (id,card_id,deck_id,previous_box,new_box,result,reviewed_at) VALUES ('e','c','d',3,4,'success',?)",
      [time],
    );
    const before = (await db.execute('SELECT * FROM review_events')).rows;
    const queues = (await db.execute('SELECT * FROM sync_operations')).rows;
    db.failStatement = 'CREATE TRIGGER deck_scheduler_eligibility';
    await expect(runMigrations(db)).rejects.toThrow('Disk full');
    expect((await db.execute('PRAGMA user_version')).rows[0]!.user_version).toBe(7);
    expect(
      (await db.execute('PRAGMA table_info(review_events)')).rows.some(
        (r) => r.name === 'review_calendar_json',
      ),
    ).toBe(false);
    db.failStatement = null;
    await runMigrations(db);
    await runMigrations(db);
    expect((await db.execute('SELECT * FROM sync_operations')).rows).toEqual(queues);
    const after = (await db.execute('SELECT * FROM review_events')).rows;
    expect(after.map(({ review_calendar_json: _calendar, ...r }) => r)).toEqual(before);
    const baseline = (await db.execute("SELECT * FROM review_replay_baselines WHERE card_id='c'"))
      .rows[0]!;
    expect(JSON.parse(String(baseline.state_json))).toMatchObject({ box: 4, totalReviews: 9 });
    expect(JSON.parse(String(baseline.included_event_ids_json))).toEqual(['e']);
  } finally {
    db.handle.close();
  }
});

test('a previously future-pinned card is available for a real corrective review, retaining counts', async () => {
  const db = await RealSqliteDatabase.open();
  try {
    await runMigrations(db);
    const repos = createSqliteRepositories(db);
    const app = createApplication(repos, fixedClock, sequenceIds());
    const deck = await app.createDeck(makeDeck());
    const card = await app.createCard({ ...makeCard(), deckId: deck.id });
    await repos.reviews.saveState({
      cardId: card.id,
      box: 2,
      dueDate: calendarDate('2076-11-15'),
      lastReviewedAt: instant('2076-11-13T08:00:00.000Z'),
      updatedAt: instant('2076-11-13T08:00:00.000Z'),
      totalReviews: 1,
      totalSuccesses: 1,
      consecutiveSuccesses: 1,
    });
    expect(
      await app.getStudyQueue({
        scope: { kind: 'all-decks' },
        targetDate: calendarDate('2026-09-24'),
      }),
    ).toMatchObject([{ cardId: card.id, clockRecovery: true }]);
    await app.reviewCard({
      cardId: card.id,
      deckId: deck.id,
      result: 'failure',
      studySessionId: null,
    });
    expect(await repos.reviews.getState(card.id)).toMatchObject({
      totalReviews: 2,
      totalSuccesses: 1,
      dueDate: '2026-09-24',
    });
  } finally {
    db.handle.close();
  }
});
