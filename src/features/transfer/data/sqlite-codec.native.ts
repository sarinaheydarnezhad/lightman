import { open, type DB, type Scalar } from '@op-engineering/op-sqlite';
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import type { PackageDatabase, PackageValue } from './package-database';

class NativePackageDatabase implements PackageDatabase {
  private readonly file: File;
  private readonly database: DB;
  private closed = false;

  constructor(bytes?: Uint8Array) {
    const directory = new Directory(Paths.cache, 'anki-packages');
    directory.create({ idempotent: true, intermediates: true });
    const name = `${randomUUID()}.anki2`;
    this.file = new File(directory, name);
    let database: DB | undefined;
    try {
      this.file.create();
      if (bytes) this.file.write(bytes);
      database = open({
        name,
        location: decodeURIComponent(directory.uri.replace(/^file:\/\//, '')),
        readOnly: !!bytes,
        failOnCreate: !!bytes,
      });
      if (!bytes) database.executeSync('PRAGMA journal_mode = DELETE');
      this.database = database;
    } catch (error) {
      database?.close();
      if (this.file.exists) this.file.delete();
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
      if (this.file.exists) this.file.delete();
    }
  }
}

export async function sqliteEngine() {
  return { Database: NativePackageDatabase };
}
