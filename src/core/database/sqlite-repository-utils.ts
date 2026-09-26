import { mapDatabaseError } from './database-error';
import type { Database, DatabaseTransaction, SqlRow, SqlValue } from './database';

export function text(row: SqlRow, column: string): string {
  const value = row[column];
  if (typeof value !== 'string') throw new Error(`Invalid local text column: ${column}`);
  return value;
}

export function nullableText(row: SqlRow, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error(`Invalid local nullable text column: ${column}`);
  return value;
}

export function integer(row: SqlRow, column: string): number {
  const value = row[column];
  if (typeof value !== 'number') throw new Error(`Invalid local integer column: ${column}`);
  return value;
}

export function booleanValue(row: SqlRow, column: string): boolean {
  return integer(row, column) !== 0;
}

export function json<T>(row: SqlRow, column: string): T {
  return JSON.parse(text(row, column)) as T;
}

export function row(result: { rows: readonly SqlRow[] }): SqlRow | null {
  return result.rows[0] ?? null;
}

export function bind(values: readonly SqlValue[]): SqlValue[] {
  return [...values];
}

export async function databaseOperation<T>(
  operation: () => Promise<T>,
  message: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapDatabaseError(error, message);
  }
}

export async function transactionOperation<T>(
  database: Database,
  operation: (transaction: DatabaseTransaction) => Promise<T>,
  message: string,
): Promise<T> {
  let value!: T;
  try {
    await database.transaction(async (transaction) => {
      value = await operation(transaction);
    });
    return value;
  } catch (error) {
    throw mapDatabaseError(error, message);
  }
}

export function normalizeSearch(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function encodeBoolean(value: boolean): number {
  return value ? 1 : 0;
}
