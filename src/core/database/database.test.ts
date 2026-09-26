import { AppError } from '@/core/errors/app-error';
import type { Database, DatabaseTransaction, SqlResult, SqlRow, SqlValue } from './database';
import { OpSqliteDatabase } from './op-sqlite-database';
import { runMigrations } from './migrations';
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

test('migration runner applies pending migrations transactionally', async () => {
  const database = new RecordingDatabase([{ rows: [{ user_version: 0 }], rowsAffected: 0 }]);

  await expect(runMigrations(database)).resolves.toBe(1);
  expect(database.transactionCount).toBe(1);
  expect(database.calls.some(({ sql }) => sql.includes('CREATE TABLE IF NOT EXISTS decks'))).toBe(
    true,
  );
  expect(database.calls.some(({ sql }) => sql === 'PRAGMA user_version = 1')).toBe(true);
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
