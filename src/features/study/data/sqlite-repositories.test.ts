import { instant, languageTag, localTime } from '@/core/domain/values';
import { makeCard, makeEvent, makeSettings, makeState } from '@/../test/fixtures';
import type { Database, DatabaseTransaction, SqlResult, SqlValue } from '@/core/database/database';
import { SQLiteCardRepository } from './sqlite-card-repository';
import { SQLiteReviewRepository } from './sqlite-review-repository';
import { SQLiteStudySessionRepository } from './sqlite-study-session-repository';
import { SQLiteSettingsRepository } from '@/features/settings/data/sqlite-settings-repository';
import { startStudySession } from '@/features/study/domain/study-session-workflow';

class ScriptedDatabase implements Database {
  constructor(private readonly responses: SqlResult[]) {}

  async execute(_sql: string, _params?: readonly SqlValue[]): Promise<SqlResult> {
    return this.responses.shift() ?? { rows: [], rowsAffected: 1 };
  }

  async transaction(operation: (transaction: DatabaseTransaction) => Promise<void>): Promise<void> {
    await operation({ execute: (sql, params) => this.execute(sql, params) });
  }
}

class RecordingTransactionDatabase implements Database {
  readonly statements: string[] = [];
  private transactionFailed = false;

  constructor(private readonly failReviewState = false) {}

  async execute(sql: string): Promise<SqlResult> {
    this.statements.push(sql);
    return { rows: [], rowsAffected: 1 };
  }

  async transaction(operation: (transaction: DatabaseTransaction) => Promise<void>): Promise<void> {
    try {
      await operation({
        execute: async (sql) => {
          this.statements.push(sql);
          if (this.failReviewState && sql.includes('INSERT INTO card_review_state')) {
            this.transactionFailed = true;
            throw new Error('constraint failure');
          }
          return { rows: [], rowsAffected: 1 };
        },
      });
    } catch (error) {
      if (!this.transactionFailed) throw error;
      throw error;
    }
  }
}

function cardRow(card = makeCard()) {
  return {
    id: card.id,
    deck_id: card.deckId,
    front_text: card.frontText,
    phonetic: card.phonetic,
    category: card.category,
    meaning: card.meaning,
    examples_json: JSON.stringify(card.examples),
    created_at: card.createdAt,
    updated_at: card.updatedAt,
    archived_at: card.archivedAt,
  };
}

function stateRow(state = makeState()) {
  return {
    card_id: state.cardId,
    box: state.box,
    due_date: state.dueDate,
    last_reviewed_at: state.lastReviewedAt,
    consecutive_successes: state.consecutiveSuccesses,
    total_reviews: state.totalReviews,
    total_successes: state.totalSuccesses,
    updated_at: state.updatedAt,
  };
}

function eventRow(event = makeEvent()) {
  return {
    id: event.id,
    card_id: event.cardId,
    deck_id: event.deckId,
    previous_box: event.previousBox,
    new_box: event.newBox,
    result: event.result,
    reviewed_at: event.reviewedAt,
    study_session_id: event.studySessionId,
  };
}

test('SQLite card repository maps examples and rejects missing cards', async () => {
  const card = makeCard({ examples: [{ sentence: 'Hello.', translation: 'Greeting' }] });
  const database = new ScriptedDatabase([
    { rows: [], rowsAffected: 1 },
    { rows: [cardRow(card)], rowsAffected: 1 },
  ]);
  const repository = new SQLiteCardRepository(database);

  await expect(repository.create(card)).resolves.toEqual(card);
  await expect(repository.getById(card.id)).resolves.toEqual(card);
  await expect(repository.getById('')).rejects.toMatchObject({ code: 'validation' });
});

test('SQLite review repository records state and event together and maps history', async () => {
  const state = makeState({ box: 2, totalReviews: 1, totalSuccesses: 1, consecutiveSuccesses: 1 });
  const event = makeEvent({ previousBox: 1, newBox: 2 });
  const database = new ScriptedDatabase([
    { rows: [stateRow(makeState())], rowsAffected: 1 },
    { rows: [], rowsAffected: 1 },
    { rows: [], rowsAffected: 1 },
    { rows: [], rowsAffected: 1 },
    { rows: [eventRow(event)], rowsAffected: 1 },
  ]);
  const repository = new SQLiteReviewRepository(database);

  await expect(repository.record(event, state)).resolves.toBeUndefined();
  await expect(repository.listEvents()).resolves.toEqual([event]);
});

test('SQLite card creation writes card and initial state in one transaction', async () => {
  const database = new RecordingTransactionDatabase();
  const repository = new SQLiteCardRepository(database);

  await expect(repository.createWithInitialReviewState(makeCard(), makeState())).resolves.toEqual(
    makeCard(),
  );
  expect(database.statements).toEqual(
    expect.arrayContaining([
      expect.stringContaining('INSERT INTO cards'),
      expect.stringContaining('INSERT INTO card_review_state'),
    ]),
  );
});

test('SQLite card creation maps initial-state failures and does not return a partial success', async () => {
  const database = new RecordingTransactionDatabase(true);
  const repository = new SQLiteCardRepository(database);

  await expect(
    repository.createWithInitialReviewState(makeCard(), makeState()),
  ).rejects.toMatchObject({
    code: 'persistence',
  });
  expect(database.statements).toHaveLength(2);
});

test('SQLite review repository counts history in SQL', async () => {
  const database = new ScriptedDatabase([{ rows: [{ count: 7 }], rowsAffected: 1 }]);
  const repository = new SQLiteReviewRepository(database);

  await expect(repository.countEvents({ deckId: 'deck-1' })).resolves.toBe(7);
});

test('SQLite settings repository keeps a successful snapshot and notifies subscribers', async () => {
  const settings = makeSettings({
    language: languageTag('en-US'),
    dailyReminderTime: localTime('10:15'),
  });
  const database = new ScriptedDatabase([{ rows: [], rowsAffected: 1 }]);
  const repository = new SQLiteSettingsRepository(database);
  const listener = jest.fn();
  repository.subscribe(listener);

  await expect(repository.update(settings)).resolves.toEqual(settings);
  expect(repository.snapshot()).toEqual(settings);
  expect(listener).toHaveBeenCalledTimes(1);
});

test('SQLite study-session repository maps a completed transition', async () => {
  const session = startStudySession(
    'session-1',
    { kind: 'all-decks' },
    [],
    instant('2026-09-24T10:00:00.000Z'),
  );
  const database = new ScriptedDatabase([
    { rows: [], rowsAffected: 1 },
    { rows: [], rowsAffected: 1 },
    {
      rows: [
        {
          id: session.id,
          scope_json: JSON.stringify(session.scope),
          status: session.status,
          started_at: session.startedAt,
          completed_at: session.completedAt,
          cancelled_at: session.cancelledAt,
          initial_queue_json: JSON.stringify(session.initialQueue),
          retry_queue_json: JSON.stringify(session.retryQueue),
          current_index: session.currentIndex,
          retry_successes: session.retrySuccesses,
        },
      ],
      rowsAffected: 1,
    },
  ]);
  const repository = new SQLiteStudySessionRepository(database);

  await expect(repository.create(session)).resolves.toEqual(session);
  await expect(repository.getById(session.id)).resolves.toEqual(session);
});
