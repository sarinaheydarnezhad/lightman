import { open, type DB, type Scalar } from '@op-engineering/op-sqlite';
import { sqliteEngine as webEngine } from './sqlite-codec.web';
import { sqliteEngine } from './sqlite-codec.native';

jest.mock('@op-engineering/op-sqlite', () => ({ open: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'package-test' }));
jest.mock('expo-file-system', () => {
  const files = new Map<string, Uint8Array>();
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
      return files.get(this.uri)!;
    }
    delete() {
      files.delete(this.uri);
    }
  }
  return { Directory, File, Paths: { cache: { uri: 'file:///cache/' } }, files };
});

const files: Map<string, Uint8Array> = jest.requireMock('expo-file-system').files;

beforeEach(async () => {
  files.clear();
  jest.clearAllMocks();
  const engine = await webEngine();
  jest.mocked(open).mockImplementation(({ name, location, readOnly }) => {
    const uri = `file://${location!.replace(/\/$/, '')}/${name}`;
    const bytes = files.get(uri);
    const database = new engine.Database(bytes?.length ? bytes : undefined);
    if (readOnly) database.run('PRAGMA query_only = ON');
    return {
      executeSync(query: string, parameters?: Scalar[]) {
        const result = database.exec(query, parameters as (string | number | null)[])[0];
        if (!readOnly) files.set(uri, database.export());
        return {
          rowsAffected: database.getRowsModified(),
          rows: result
            ? result.values.map((values) =>
                Object.fromEntries(result.columns.map((column, index) => [column, values[index]])),
              )
            : [],
        };
      },
      close: () => database.close(),
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
