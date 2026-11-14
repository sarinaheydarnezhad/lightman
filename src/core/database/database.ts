export type SqlValue = string | number | null;

export interface SqlRow {
  readonly [column: string]: SqlValue;
}

export interface SqlResult {
  readonly rows: readonly SqlRow[];
  readonly rowsAffected: number;
}

export interface DatabaseTransaction {
  execute(sql: string, params?: readonly SqlValue[]): Promise<SqlResult>;
}

export interface Database {
  execute(sql: string, params?: readonly SqlValue[]): Promise<SqlResult>;
  /** Use only the supplied transaction inside the callback; do not reacquire this connection. */
  transaction(operation: (transaction: DatabaseTransaction) => Promise<void>): Promise<void>;
}
