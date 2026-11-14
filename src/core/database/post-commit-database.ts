import type { Database, DatabaseTransaction, SqlValue } from './database';

/** Signals are hints only: SQLite's durable outbox remains the source of truth. */
export class PostCommitDatabase implements Database {
  private readonly listeners = new Set<() => void>();
  constructor(
    private readonly database: Database,
    private readonly onNotificationError: (error: unknown) => void = () => {},
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  async execute(sql: string, params?: readonly SqlValue[]) {
    const result = await this.database.execute(sql, params);
    if (/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql)) this.committed();
    return result;
  }

  async transaction(operation: (transaction: DatabaseTransaction) => Promise<void>): Promise<void> {
    await this.database.transaction(operation);
    this.committed();
  }

  private committed(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        // A notification failure must never turn a committed save into a failed save.
        try {
          this.onNotificationError(error);
        } catch {}
      }
    }
  }
}
