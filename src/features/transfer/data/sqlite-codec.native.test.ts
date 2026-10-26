import { open, type DB, type Scalar } from '@op-engineering/op-sqlite';
import { sqliteEngine as webEngine } from './sqlite-codec.web';
import { openAnkiMetadataDatabase, sqliteEngine } from './sqlite-codec.native';
import { apkgAdapter } from './apkg-adapter';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

jest.mock('@op-engineering/op-sqlite', () => ({ open: jest.fn() }));
jest.mock('./sqlite-codec', () => jest.requireActual('./sqlite-codec.native'));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'package-test' }));
jest.mock('expo-file-system', () => {
  const files = new Map<string, Uint8Array>();
  const readers = new Map<string, () => Uint8Array>();
  class Directory {
    uri: string;
    constructor(parent: { uri: string }, name: string) {
      this.uri = `${parent.uri}${name}/`;
    }
    create() {}
  }
  class File {
    uri: string;
    constructor(parent: { uri: string }, name: string) {
      this.uri = `${parent.uri}${name}`;
    }
    get exists() {
      return files.has(this.uri);
    }
    create() {
      files.set(this.uri, new Uint8Array());
    }
    write(bytes: Uint8Array) {
      files.set(this.uri, bytes);
    }
    bytesSync() {
      return readers.get(this.uri)?.() ?? files.get(this.uri)!;
    }
    delete() {
      files.delete(this.uri);
      readers.delete(this.uri);
    }
  }
  return { Directory, File, Paths: { cache: { uri: 'file:///cache/' } }, files, readers };
});

const files: Map<string, Uint8Array> = jest.requireMock('expo-file-system').files;
const readers: Map<string, () => Uint8Array> = jest.requireMock('expo-file-system').readers;

let NativeSQLite: typeof import('node:sqlite').DatabaseSync | undefined;
try {
  NativeSQLite = jest.requireActual('node:sqlite').DatabaseSync;
} catch {
  NativeSQLite = undefined;
}
const nativeIntegrationTest = NativeSQLite ? test : test.skip;

function modernPackage() {
  return new Uint8Array(
    Buffer.from(readFileSync('test/fixtures/anki-modern.apkg.base64', 'utf8').trim(), 'base64'),
  );
}

beforeEach(async () => {
  files.clear();
  readers.clear();
  jest.clearAllMocks();
  const engine = await webEngine();
  jest.mocked(open).mockImplementation(({ name, location, readOnly }) => {
    const uri = `file://${location!.replace(/\/$/, '')}/${name}`;
    const bytes = files.get(uri);
    const database = new engine.Database(bytes?.length ? bytes : undefined);
    if (readOnly) database.run('PRAGMA query_only = ON');
    else readers.set(uri, () => database.export());
    return {
      executeSync(query: string, parameters?: Scalar[]) {
        const result = database.exec(query, parameters as (string | number | null)[])[0];
        return {
          rowsAffected: database.getRowsModified(),
          rows: result
            ? result.values.map((values) =>
                Object.fromEntries(result.columns.map((column, index) => [column, values[index]])),
              )
            : [],
        };
      },
      close() {
        if (!readOnly) files.set(uri, database.export());
        readers.delete(uri);
        database.close();
      },
    } as unknown as DB;
  });
});

test('native export writes real SQLite bytes with the existing engine, then deletes its cache file', async () => {
  const engine = await sqliteEngine();
  const database = new engine.Database();
  database.run('CREATE TABLE content(value TEXT); CREATE INDEX content_value ON content(value);');
  database.run('INSERT INTO content VALUES (?)', ['سلام\nمرحبا']);
  expect(database.exec('SELECT value FROM content')[0]?.values).toEqual([['سلام\nمرحبا']]);
  const exported = database.export();
  expect(exported.length).toBeGreaterThan(0);
  const verifier = new (await webEngine()).Database(exported);
  expect(verifier.exec('PRAGMA integrity_check')[0]?.values).toEqual([['ok']]);
  verifier.close();
  expect(files.size).toBe(1);
  database.close();
  database.close();
  expect(files.size).toBe(0);
});

test('native import opens a temporary collection read-only and never touches application storage', async () => {
  const source = new (await webEngine()).Database();
  source.run('CREATE TABLE content(value TEXT)');
  source.run('INSERT INTO content VALUES (?)', ['Unicode: فارسی']);
  const bytes = source.export();
  source.close();
  const engine = await sqliteEngine();
  const database = new engine.Database(bytes);
  expect(open).toHaveBeenLastCalledWith({
    name: 'package-test.anki2',
    location: '/cache/anki-packages/',
    readOnly: true,
    failOnCreate: true,
  });
  expect(database.exec('SELECT value FROM content')[0]?.values).toEqual([['Unicode: فارسی']]);
  expect(() => database.run('DELETE FROM content')).toThrow();
  database.close();
  expect(files.size).toBe(0);
});

test('failed native initialization cleans up the temporary collection', async () => {
  jest.mocked(open).mockImplementationOnce(() => {
    throw new Error('Cannot open');
  });
  const engine = await sqliteEngine();
  expect(() => new engine.Database()).toThrow('Cannot open');
  expect(files.size).toBe(0);
});

test('failed metadata normalization deletes its scratch collection and journal files', async () => {
  const source = new (await webEngine()).Database();
  source.run('CREATE TABLE fields (ntid INTEGER, ord INTEGER, name TEXT)');
  const bytes = source.export();
  source.close();
  const defaultOpen = jest.mocked(open).getMockImplementation()!;
  jest.mocked(open).mockImplementationOnce((options) => {
    const database = defaultOpen(options);
    const executeSync = database.executeSync.bind(database);
    const uri = `file://${options.location!.replace(/\/$/, '')}/${options.name}`;
    database.executeSync = (sql: string) => {
      if (sql === 'PRAGMA writable_schema = ON') {
        for (const suffix of ['-wal', '-shm', '-journal'])
          files.set(uri + suffix, new Uint8Array());
        throw new Error('Unable to normalize metadata');
      }
      return executeSync(sql);
    };
    return database;
  });
  await expect(openAnkiMetadataDatabase(bytes)).rejects.toThrow('Unable to normalize metadata');
  expect(files.size).toBe(0);
  expect(readers.size).toBe(0);
});

test.each([
  ['SELECT id, name FROM decks', 'no such collation sequence: unicase'],
  ['SELECT ntid, ord, name FROM fields ORDER BY ntid, ord', 'no query solution'],
])('reads normalized native Anki metadata when %s fails with %s', async (query, message) => {
  const defaultOpen = jest.mocked(open).getMockImplementation()!;
  jest.mocked(open).mockImplementationOnce((options) => {
    const database = defaultOpen(options);
    const executeSync = database.executeSync.bind(database);
    database.executeSync = (sql: string) => {
      if (sql === query) throw new Error(message);
      return executeSync(sql);
    };
    return database;
  });
  const parsed = await apkgAdapter.parse(modernPackage(), 'Fallback');
  expect(parsed.issues).toEqual([]);
  expect(parsed.records).toHaveLength(1);
  expect(parsed.records[0]?.card.deckName).not.toBe('Fallback');
  expect(files.size).toBe(0);
});

test('does not hide unrelated native Anki metadata errors and cleans up the collection', async () => {
  const defaultOpen = jest.mocked(open).getMockImplementation()!;
  jest.mocked(open).mockImplementationOnce((options) => {
    const database = defaultOpen(options);
    const executeSync = database.executeSync.bind(database);
    database.executeSync = (sql: string) => {
      if (sql.includes('FROM fields')) throw new Error('database disk image is malformed');
      return executeSync(sql);
    };
    return database;
  });
  await expect(apkgAdapter.parse(modernPackage(), 'Fallback')).rejects.toThrow(
    'database disk image is malformed',
  );
  expect(files.size).toBe(0);
});

nativeIntegrationTest('imports a genuine modern Anki package with real native SQLite', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'lerona-anki-'));
  let originalCollection: Uint8Array | undefined;
  jest.mocked(open).mockImplementation(({ name, location, readOnly }) => {
    const path = join(directory, name);
    const uri = `file://${location!.replace(/\/$/, '')}/${name}`;
    if (name === 'package-test.anki2') originalCollection = files.get(uri)!.slice();
    if (!existsSync(path)) writeFileSync(path, files.get(uri)!);
    const database = new NativeSQLite!(path, { readOnly, defensive: false });
    return {
      executeSync(query: string, parameters: (string | number | null)[] = []) {
        const statement = database.prepare(query);
        if (statement.columns().length) return { rows: statement.all(...parameters) };
        statement.run(...parameters);
        return { rows: [] };
      },
      close: () => database.close(),
    } as unknown as DB;
  });
  try {
    const parsed = await apkgAdapter.parse(modernPackage(), 'Fallback');
    expect(parsed.issues).toEqual([]);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]?.card).toMatchObject({
      frontText: expect.stringContaining('سلام'),
      meaning: expect.stringContaining('معنی'),
      phonetic: '/sæˈlɑːm/',
      category: 'اسم',
    });
    expect(open).toHaveBeenCalledTimes(3);
    expect(open).toHaveBeenLastCalledWith({
      name: 'package-test-metadata.anki2',
      location: '/cache/anki-packages/',
      readOnly: true,
      failOnCreate: true,
    });
    expect(new Uint8Array(readFileSync(join(directory, 'package-test.anki2')))).toEqual(
      originalCollection,
    );
    expect(files.size).toBe(0);
  } finally {
    for (const name of ['package-test.anki2', 'package-test-metadata.anki2']) {
      for (const suffix of ['', '-wal', '-shm', '-journal']) {
        const path = join(directory, name + suffix);
        if (existsSync(path)) unlinkSync(path);
      }
    }
    rmdirSync(directory);
  }
});
