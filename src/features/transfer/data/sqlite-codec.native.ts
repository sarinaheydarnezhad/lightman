import { open, type DB, type Scalar } from '@op-engineering/op-sqlite';
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import type { PackageDatabase, PackageValue } from './package-database';

class NativePackageDatabase implements PackageDatabase {
  private readonly file: File;
  private readonly sidecars: File[];
  private readonly database: DB;
  private closed = false;

  constructor(bytes?: Uint8Array, normalizeMetadata = false) {
    const directory = new Directory(Paths.cache, 'anki-packages');
    directory.create({ idempotent: true, intermediates: true });
    const name = `${randomUUID()}${normalizeMetadata ? '-metadata' : ''}.anki2`;
    this.file = new File(directory, name);
    this.sidecars = ['-wal', '-shm', '-journal'].map(
      (suffix) => new File(directory, name + suffix),
    );
    let database: DB | undefined;
    try {
      this.file.create();
      if (bytes) this.file.write(bytes);
      const options = {
        name,
        location: decodeURIComponent(directory.uri.replace(/^file:\/\//, '')),
        failOnCreate: !!bytes,
      };
      database = open({ ...options, readOnly: !!bytes && !normalizeMetadata });
      if (normalizeMetadata) {
        const schemas = database.executeSync(
          "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name IN ('decks', 'fields')",
        ).rows;
        database.executeSync('PRAGMA writable_schema = ON');
        for (const schema of schemas) {
          const sql = String(schema.sql);
          const normalized = sql.replace(/\bCOLLATE\s+unicase\b/gi, 'COLLATE BINARY');
          if (normalized !== sql)
            database.executeSync(
              "UPDATE sqlite_master SET sql = ? WHERE type = 'table' AND name = ?",
              [normalized, String(schema.name)],
            );
        }
        database.executeSync('PRAGMA writable_schema = RESET');
        database.close();
        database = undefined;
        database = open({ ...options, readOnly: true });
      }
      if (!bytes) database.executeSync('PRAGMA journal_mode = DELETE');
      this.database = database;
    } catch (error) {
      database?.close();
      this.deleteFiles();
      throw error;
    }
  }

  run(sql: string, parameters?: PackageValue[]) {
    if (parameters) this.database.executeSync(sql, parameters);
    else
      for (const statement of sql
        .split(';')
        .map((value) => value.trim())
        .filter(Boolean)) {
        this.database.executeSync(statement);
      }
    return this;
  }

  exec(sql: string) {
    const result = this.database.executeSync(sql);
    if (!result.rows.length) return [];
    const columns = Object.keys(result.rows[0]!);
    const convert = (value: Scalar): PackageValue => {
      if (typeof value === 'string' || typeof value === 'number' || value === null) return value;
      if (typeof value === 'boolean') return Number(value);
      if (value instanceof Uint8Array) return value;
      return null;
    };
    return [
      {
        columns,
        values: result.rows.map((row) => columns.map((column) => convert(row[column] ?? null))),
      },
    ];
  }

  export() {
    return this.file.bytesSync();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try {
      this.database.close();
    } finally {
      this.deleteFiles();
    }
  }

  private deleteFiles() {
    for (const file of [this.file, ...this.sidecars]) {
      if (file.exists) file.delete();
    }
  }
}

export async function sqliteEngine() {
  return { Database: NativePackageDatabase };
}

export async function openAnkiMetadataDatabase(bytes: Uint8Array): Promise<PackageDatabase> {
  return new NativePackageDatabase(bytes, true);
}
