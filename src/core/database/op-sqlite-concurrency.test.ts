import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { makeSettings } from '@/../test/fixtures';
import { OpSqliteDatabase } from './op-sqlite-database';
import { runMigrations } from './migrations';
import type { DatabaseTransaction } from './database';
import { SQLiteSettingsRepository } from '@/features/settings/data/sqlite-settings-repository';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const handles: RealSqliteDatabase[] = [];
afterEach(() => {
  handles.splice(0).forEach((db) => db.handle.close());
});
async function setup() {
  const raw = await RealSqliteDatabase.open();
  handles.push(raw);
  const nativeTransaction = jest.fn().mockRejectedValue(new Error('unsupported web rollback'));
  const database = new OpSqliteDatabase('synthetic-concurrency.db');
  // Supply an already opened SQL.js handle; native JSI and Expo dynamic imports cannot run in Jest.
  Object.defineProperty(database, 'database', {
    value: { execute: raw.execute.bind(raw), transaction: nativeTransaction },
    writable: true,
  });
  await runMigrations(database);
  return { raw, database, nativeTransaction };
}

test('ordinary statements and transactions cannot join or observe an awaited uncommitted transaction', async () => {
  const { raw, database, nativeTransaction } = await setup();
  await database.execute('CREATE TABLE probe (id INTEGER PRIMARY KEY, value TEXT)');
  const entered = deferred(),
    release = deferred();
  const first = database.transaction(async (tx) => {
    await tx.execute("INSERT INTO probe VALUES (1, 'rollback')");
    entered.resolve();
    await release.promise;
    throw new Error('injected transaction failure');
  });
  const failure = expect(first).rejects.toThrow('injected transaction failure');
  await entered.promise;
  const outside = database.execute("INSERT INTO probe VALUES (2, 'independent')");
  const next = database.transaction(async (tx) => {
    await tx.execute("INSERT INTO probe VALUES (3, 'next')");
  });
  expect((await raw.execute('SELECT id FROM probe')).rows).toEqual([{ id: 1 }]);
  release.resolve();
  await Promise.all([failure, outside, next]);
  expect((await database.execute('SELECT id FROM probe ORDER BY id')).rows).toEqual([
    { id: 2 },
    { id: 3 },
  ]);
  expect(nativeTransaction).not.toHaveBeenCalled();
});

test('transaction handles cannot escape their callback and migration remains idempotent', async () => {
  const { database } = await setup();
  let escaped!: DatabaseTransaction;
  await database.transaction(async (tx) => {
    escaped = tx;
  });
  await expect(escaped.execute('SELECT 1')).rejects.toThrow('transaction has ended');
  await runMigrations(database);
  expect((await database.execute('PRAGMA user_version')).rows[0]?.user_version).toBe(9);
});

test('settings repository writes through the real wrapper and publishes only after commit', async () => {
  const { database, raw } = await setup();
  const settings = new SQLiteSettingsRepository(database);
  await settings.initialize(makeSettings());
  const snapshots: string[] = [];
  settings.subscribe(() => snapshots.push(settings.snapshot()!.theme));
  raw.failStatement = 'INSERT INTO user_settings';
  await expect(settings.update({ theme: 'dark' })).rejects.toMatchObject({ code: 'persistence' });
  expect(snapshots).toEqual([]);
  raw.failStatement = null;
  await Promise.all([
    settings.update({ theme: 'dark' }),
    settings.update({ hapticsEnabled: false }),
  ]);
  expect(settings.snapshot()).toMatchObject({ theme: 'dark', hapticsEnabled: false });
  expect(
    (await database.execute('SELECT theme,haptics_enabled FROM user_settings')).rows[0],
  ).toEqual({ theme: 'dark', haptics_enabled: 0 });
});

test('failed rollback invalidates the connection and queued statements cannot commit unknown work', async () => {
  const { raw, database } = await setup();
  raw.failStatement = 'ROLLBACK';
  const failure = database.transaction(async () => {
    throw new Error('injected');
  });
  const next = database.execute('SELECT 1');
  await expect(failure).rejects.toThrow('Unable to roll back local data');
  await expect(next).rejects.toThrow('Database has not been initialized');
});

test('failed COMMIT rolls back the settings row and outbox and publishes no success', async () => {
  const { database, raw } = await setup();
  const settings = new SQLiteSettingsRepository(database);
  await settings.initialize(makeSettings());
  const operations = (await database.execute('SELECT * FROM sync_operations')).rows;
  raw.failStatement = 'COMMIT';
  await expect(settings.update({ theme: 'dark' })).rejects.toMatchObject({ code: 'persistence' });
  expect(settings.snapshot()?.theme).toBe('light');
  raw.failStatement = null;
  expect((await database.execute('SELECT theme FROM user_settings')).rows[0]?.theme).toBe('light');
  expect((await database.execute('SELECT * FROM sync_operations')).rows).toEqual(operations);
  await settings.update({ theme: 'dark' });
  expect(settings.snapshot()?.theme).toBe('dark');
});
