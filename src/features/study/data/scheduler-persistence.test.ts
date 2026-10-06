import type {
  Database,
  DatabaseTransaction,
  SqlResult,
  SqlRow,
  SqlValue,
} from '@/core/database/database';
import { migrations, runMigrations } from '@/core/database/migrations';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { createApplication } from '@/core/application/create-application';
import {
  fixedClock,
  makeCard,
  makeDeck,
  makeEvent,
  makeState,
  sequenceIds,
} from '@/../test/fixtures';
import { testScheduler } from '@/../test/scheduler-fixture';
import { LeitnerScheduler } from '../domain/leitner-scheduler';
import { createReviewEngine } from '../domain/review-engine-impl';

interface NativeDatabase {
  prepare(sql: string): {
    columns(): readonly unknown[];
    all(...params: readonly SqlValue[]): SqlRow[];
    run(...params: readonly SqlValue[]): { changes: number };
  };
  exec(sql: string): void;
  close(): void;
}

let NativeSQLite: (new (filename: string) => NativeDatabase) | undefined;
try {
  NativeSQLite = jest.requireActual('node:sqlite').DatabaseSync;
} catch {
  NativeSQLite = undefined;
}
const integrationTest = NativeSQLite ? test : test.skip;

class TestDatabase implements Database {
  readonly connection = new NativeSQLite!(':memory:');
  failStatement: string | null = null;

  async execute(sql: string, params: readonly SqlValue[] = []): Promise<SqlResult> {
    if (this.failStatement && sql.includes(this.failStatement))
      throw new Error('Injected write failure');
    const statement = this.connection.prepare(sql);
    return statement.columns().length
      ? { rows: statement.all(...params), rowsAffected: 0 }
      : { rows: [], rowsAffected: Number(statement.run(...params).changes) };
  }

  async transaction(operation: (transaction: DatabaseTransaction) => Promise<void>): Promise<void> {
    this.connection.exec('BEGIN');
    try {
      await operation(this);
      this.connection.exec('COMMIT');
    } catch (error) {
      this.connection.exec('ROLLBACK');
      throw error;
    }
  }
}

integrationTest(
  'upgrading existing SQLite data defaults decks to Leitner without losing boxes, due dates or immutable history',
  async () => {
    const database = new TestDatabase();
    try {
      for (const migration of migrations.slice(0, 3)) {
        for (const statement of migration.statements) await database.execute(statement);
        await database.execute(`PRAGMA user_version = ${migration.version}`);
      }
      const deck = makeDeck();
      await database.execute(
        'INSERT INTO decks (id, name, description, language, text_alignment, typography_size, created_at, updated_at, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          deck.id,
          deck.name,
          deck.description,
          deck.language,
          deck.textAlignment,
          deck.typographySize,
          deck.createdAt,
          deck.updatedAt,
          null,
        ],
      );
      const repositories = createSqliteRepositories(database);
      const card = makeCard();
      await repositories.cards.create(card);
      await database.execute(
        'INSERT INTO card_review_state (card_id, box, due_date, last_reviewed_at, consecutive_successes, total_reviews, total_successes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [card.id, 3, '2026-10-01', null, 2, 2, 2, card.updatedAt],
      );
      const event = makeEvent();
      await database.execute(
        'INSERT INTO review_events (id, card_id, deck_id, previous_box, new_box, result, reviewed_at, study_session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          event.id,
          event.cardId,
          event.deckId,
          event.previousBox!,
          event.newBox!,
          event.result,
          event.reviewedAt,
          null,
        ],
      );
      const before = await database.execute('SELECT * FROM card_review_state');
      expect(await runMigrations(database)).toBe(5);
      expect((await repositories.decks.getById(deck.id))?.reviewSystem).toBe('leitner');
      expect(await repositories.reviews.getState(card.id)).toMatchObject({
        box: 3,
        dueDate: '2026-10-01',
        totalReviews: 2,
      });
      expect((await database.execute('SELECT * FROM card_review_state')).rows[0]).toMatchObject(
        before.rows[0]!,
      );
      expect(await repositories.reviews.listEvents()).toEqual([event]);
      expect(await runMigrations(database)).toBe(5);
    } finally {
      database.connection.close();
    }
  },
);

integrationTest(
  'SQLite stores each deck scheduler and opaque non-Leitner state and event metadata across repository reloads',
  async () => {
    const database = new TestDatabase();
    try {
      await runMigrations(database);
      const engine = createReviewEngine([LeitnerScheduler, testScheduler]);
      const repos = createSqliteRepositories(database);
      const app = createApplication(repos, fixedClock, sequenceIds(), undefined, engine);
      await repos.decks.create(makeDeck());
      await repos.decks.create(makeDeck({ id: 'custom' }));
      await app.updateDeck('custom', { reviewSystem: testScheduler.id });
      const card = await app.createCard({ ...makeCard(), deckId: 'custom' });
      await app.reviewCard({
        cardId: card.id,
        deckId: card.deckId,
        result: 'success',
        studySessionId: null,
      });
      const reloaded = createApplication(
        createSqliteRepositories(database),
        fixedClock,
        sequenceIds(),
        undefined,
        engine,
      );
      expect((await reloaded.getDeck('deck-1')).reviewSystem).toBe('leitner');
      expect((await reloaded.getDeck('custom')).reviewSystem).toBe(testScheduler.id);
      expect(await reloaded.getReviewState(card.id)).toEqual(await app.getReviewState(card.id));
      expect((await reloaded.getReviewState(card.id))?.box).toBeUndefined();
      expect(await reloaded.listReviewEvents()).toEqual(await app.listReviewEvents());
      expect(await reloaded.getDeckDistribution('custom')).toMatchObject({
        sections: [{ count: 0 }, { count: 1 }, { count: 0 }],
      });
    } finally {
      database.connection.close();
    }
  },
);

integrationTest(
  'completed missed-card queues and retry sessions survive SQLite reloads and opening retry creates no event',
  async () => {
    const database = new TestDatabase();
    try {
      await runMigrations(database);
      const ids = sequenceIds();
      let app = createApplication(createSqliteRepositories(database), fixedClock, ids);
      await app.createDeck(makeDeck());
      const deck = (await app.listDecks())[0]!;
      const card = await app.createCard({ ...makeCard(), deckId: deck.id });
      const original = await app.startStudySession({ kind: 'specific-deck', deckId: deck.id });
      for (const result of ['failure', 'success'] as const) {
        const item = (await app.getCurrentStudyItem(original.id))!;
        await app.submitStudyAnswer({
          sessionId: original.id,
          cardId: card.id,
          presentationId: item.presentationId,
          result,
        });
      }
      app = createApplication(createSqliteRepositories(database), fixedClock, ids);
      expect(
        (await app.getStudySession(original.id)).missedQueue?.map((item) => item.cardId),
      ).toEqual([card.id]);
      const state = await app.getReviewState(card.id);
      const retry = await app.reviewMissedCards(original.id);
      app = createApplication(createSqliteRepositories(database), fixedClock, ids);
      expect((await app.getActiveStudySession())?.sourceSessionId).toBe(original.id);
      expect(await app.getReviewState(card.id)).toEqual(state);
      expect(await app.listReviewEvents()).toHaveLength(2);
      const item = (await app.getCurrentStudyItem(retry.id))!;
      await app.submitStudyAnswer({
        sessionId: retry.id,
        cardId: card.id,
        presentationId: item.presentationId,
        result: 'failure',
      });
      const snapshot = await app.getStudySnapshot(retry.id);
      expect(snapshot.progress).toMatchObject({
        uniqueCardsStudied: 1,
        failedInitialAnswers: 1,
        canReviewAgain: false,
        isComplete: true,
      });
      expect(await app.listReviewEvents()).toHaveLength(3);
    } finally {
      database.connection.close();
    }
  },
);

integrationTest(
  'a failed atomic study commit rolls back event, scheduling state, and progress so submitting again records only one review',
  async () => {
    const database = new TestDatabase();
    try {
      await runMigrations(database);
      const repos = createSqliteRepositories(database);
      const app = createApplication(repos, fixedClock, sequenceIds());
      await repos.decks.create(makeDeck());
      await repos.cards.create(makeCard());
      await repos.reviews.saveState(makeState());
      const session = await app.startStudySession({ kind: 'all-decks' });
      const item = (await app.getCurrentStudyItem(session.id))!;
      const input = {
        sessionId: session.id,
        cardId: item.cardId,
        presentationId: item.presentationId,
        result: 'success' as const,
      };
      database.failStatement = 'INSERT INTO review_events';
      await expect(app.submitStudyAnswer(input)).rejects.toMatchObject({ code: 'persistence' });
      expect(await app.listReviewEvents()).toEqual([]);
      expect(await app.getReviewState(item.cardId)).toEqual(makeState());
      expect((await app.getStudySession(session.id)).currentIndex).toBe(0);
      database.failStatement = null;
      await app.submitStudyAnswer(input);
      expect(await app.listReviewEvents()).toHaveLength(1);
      await expect(app.submitStudyAnswer(input)).rejects.toMatchObject({ code: 'conflict' });
      expect(await app.listReviewEvents()).toHaveLength(1);
    } finally {
      database.connection.close();
    }
  },
);
