import initializeSqlite, { type Database as SqliteHandle } from 'sql.js';
import type { Database, DatabaseTransaction, SqlResult, SqlValue } from '@/core/database/database';

export class RealSqliteDatabase implements Database {
  failStatement: string | null = null;
  private constructor(readonly handle: SqliteHandle) {}

  static async open(bytes?: Uint8Array): Promise<RealSqliteDatabase> {
    const sqlite = await initializeSqlite();
    const database = new RealSqliteDatabase(new sqlite.Database(bytes));
    database.handle.run('PRAGMA foreign_keys = ON');
    return database;
  }

  async execute(sql: string, params?: readonly SqlValue[]): Promise<SqlResult> {
    if (this.failStatement && sql.includes(this.failStatement)) throw new Error('Disk full');
    const statement = this.handle.prepare(sql);
    try {
      if (params) statement.bind([...params]);
      const rows: Record<string, SqlValue>[] = [];
      while (statement.step()) rows.push(statement.getAsObject() as Record<string, SqlValue>);
      return { rows, rowsAffected: this.handle.getRowsModified() };
    } finally {
      statement.free();
    }
  }

  async transaction(operation: (transaction: DatabaseTransaction) => Promise<void>): Promise<void> {
    this.handle.run('BEGIN IMMEDIATE');
    try {
      await operation(this);
      this.handle.run('COMMIT');
    } catch (error) {
      this.handle.run('ROLLBACK');
      throw error;
    }
  }
}
