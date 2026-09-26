import { AppError } from '@/core/errors/app-error';
import type { Database, DatabaseTransaction, SqlResult, SqlRow, SqlValue } from './database';
import { OpSqliteDatabase } from './op-sqlite-database';
import { migrations, runMigrations } from './migrations';
import { openAsync } from '@op-engineering/op-sqlite';

jest.mock('@op-engineering/op-sqlite', () => ({
  openAsync: jest.fn(),
}));

class RecordingDatabase implements Database {
  readonly calls: { sql: string; params?: readonly SqlValue[] }[] = [];
  transactionCount = 0;

  constructor(private readonly responses: SqlResult[] = []) {}

  async execute(sql: string, params?: readonly SqlValue[]): Promise<SqlResult> {
    this.calls.push({ sql, params });
    return this.responses.shift() ?? { rows: [], rowsAffected: 1 };
  }

  async transaction(operation: (transaction: DatabaseTransaction) => Promise<void>): Promise<void> {
    this.transactionCount += 1;
    await operation({ execute: (sql, params) => this.execute(sql, params) });
  }
}

test('fresh migration applies every schema version transactionally', async () => {
  const database = new RecordingDatabase([{ rows: [{ user_version: 0 }], rowsAffected: 0 }]);

  await expect(runMigrations(database)).resolves.toBe(2);
  expect(database.transactionCount).toBe(2);
  expect(database.calls.some(({ sql }) => sql.includes('CREATE TABLE IF NOT EXISTS decks'))).toBe(
    true,
  );
  expect(database.calls.some(({ sql }) => sql.includes('CREATE TABLE card_review_state'))).toBe(
    true,
  );
  expect(database.calls.some(({ sql }) => sql.includes('CREATE TABLE user_settings'))).toBe(true);
  expect(database.calls.some(({ sql }) => sql === 'PRAGMA user_version = 2')).toBe(true);
});

test('version one upgrade preserves rows through the production schema rebuild', async () => {
  const database = new RecordingDatabase([{ rows: [{ user_version: 1 }], rowsAffected: 0 }]);

  await expect(runMigrations(database)).resolves.toBe(2);
  expect(database.transactionCount).toBe(1);
  expect(
    database.calls.some(
      ({ sql }) => sql === 'ALTER TABLE review_states RENAME TO review_states_v1',
    ),
  ).toBe(true);
  expect(
    database.calls.some(
      ({ sql }) =>
        sql.includes('INSERT INTO card_review_state') && sql.includes('FROM review_states_v1'),
    ),
  ).toBe(true);
  expect(
    database.calls.some(
      ({ sql }) =>
        sql.includes('INSERT INTO review_events') && sql.includes('FROM review_events_v1'),
    ),
  ).toBe(true);
  expect(database.calls.some(({ sql }) => sql === 'PRAGMA user_version = 2')).toBe(true);
});

test('migration runner skips an already current database', async () => {
  const database = new RecordingDatabase([{ rows: [{ user_version: 2 }], rowsAffected: 0 }]);

  await expect(runMigrations(database)).resolves.toBe(2);
  expect(database.transactionCount).toBe(0);
});

test('production schema protects review history and review-state invariants', () => {
  const statements = migrations[1]!.statements.join('\n');

  expect(statements).toContain('REFERENCES decks(id) ON DELETE RESTRICT');
  expect(statements).toContain('REFERENCES cards(id) ON DELETE CASCADE');
  expect(statements).toContain('CHECK (box BETWEEN 1 AND 5)');
  expect(statements).toContain("CHECK (result IN ('success', 'failure'))");
  expect(statements).toContain('CHECK (consecutive_successes <= total_successes)');
  expect(statements).toContain('CREATE INDEX cards_active_deck_idx');
  expect(statements).toContain('CREATE INDEX card_review_state_due_date_idx');
  expect(statements).toContain('CREATE INDEX review_events_reviewed_at_idx');
  expect(statements).toContain('CREATE TRIGGER review_events_no_update');
  expect(statements).toContain('CREATE TRIGGER review_events_no_delete');
});

test('OP-SQLite initialization maps native failures to safe application errors', async () => {
  jest.mocked(openAsync).mockRejectedValueOnce(new Error('native SQL statement and path details'));
  const database = new OpSqliteDatabase('test.db');

  await expect(database.initialize()).rejects.toMatchObject({
    code: 'persistence',
    message: 'Unable to initialize the local database.',
  });
  await expect(database.initialize()).rejects.toBeInstanceOf(AppError);
});

export function result(rows: readonly SqlRow[] = [], rowsAffected = 1): SqlResult {
  return { rows, rowsAffected };
}
