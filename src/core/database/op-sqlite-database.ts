import type { DB, Scalar } from '@op-engineering/op-sqlite';
import { mapDatabaseError } from './database-error';
import type { Database, DatabaseTransaction, SqlResult, SqlValue } from './database';
import { runMigrations } from './migrations';

function toNativeParams(params?: readonly SqlValue[]): Scalar[] | undefined {
  return params ? [...params] : undefined;
}

function mapResult(result: { rows: Record<string, Scalar>[]; rowsAffected: number }): SqlResult {
  return {
    rows: result.rows.map((row) => {
      const mapped: Record<string, SqlValue> = {};
      for (const [key, value] of Object.entries(row)) {
        mapped[key] =
          typeof value === 'boolean'
            ? value
              ? 1
              : 0
            : typeof value === 'string' || typeof value === 'number' || value === null
              ? value
              : null;
      }
      return mapped;
    }),
    rowsAffected: result.rowsAffected,
  };
}

class OpSqliteTransaction implements DatabaseTransaction {
  constructor(
    private readonly transaction: {
      execute(
        sql: string,
        params?: Scalar[],
      ): Promise<{ rows: Record<string, Scalar>[]; rowsAffected: number }>;
    },
  ) {}

  async execute(sql: string, params?: readonly SqlValue[]): Promise<SqlResult> {
    return mapResult(await this.transaction.execute(sql, toNativeParams(params)));
  }
}

export class OpSqliteDatabase implements Database {
  private database: DB | null = null;
  private initialization: Promise<void> | null = null;

  constructor(private readonly name = 'lightman.db') {}

  initialize(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.openAndMigrate().catch((error: unknown) => {
        this.initialization = null;
        throw mapDatabaseError(error, 'Unable to initialize the local database.');
      });
    }
    return this.initialization;
  }

  async execute(sql: string, params?: readonly SqlValue[]): Promise<SqlResult> {
    const database = this.requireDatabase();
    return mapResult(await database.execute(sql, toNativeParams(params)));
  }

  async transaction(operation: (transaction: DatabaseTransaction) => Promise<void>): Promise<void> {
    const database = this.requireDatabase();
    await database.transaction(async (transaction) =>
      operation(new OpSqliteTransaction(transaction)),
    );
  }

  private async openAndMigrate(): Promise<void> {
    const { openAsync } = await import('@op-engineering/op-sqlite');
    this.database = await openAsync({ name: this.name });
    await runMigrations(this);
  }

  private requireDatabase(): DB {
    if (!this.database) throw new Error('Database has not been initialized.');
    return this.database;
  }
}
