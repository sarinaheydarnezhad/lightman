import { getRandomValues } from 'expo-crypto';
import initSqlJs from 'sql.js/dist/sql-asm-memory-growth.js';

let engine: ReturnType<typeof initSqlJs> | undefined;

export async function sqliteEngine() {
  if (!globalThis.crypto?.getRandomValues) {
    Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues }, configurable: true });
  }
  engine ??= initSqlJs();
  return engine;
}

export async function openAnkiMetadataDatabase(bytes: Uint8Array) {
  const sqlite = await sqliteEngine();
  return new sqlite.Database(bytes);
}
