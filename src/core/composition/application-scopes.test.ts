import { LocalStorageScopes } from '@/core/storage/local-storage-scopes';
import type { Repositories } from '@/core/ports/repositories';
import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { runMigrations } from '@/core/database/migrations';
import { createSqliteRepositories } from './sqlite-repositories';
import { application, activeApplication } from './application';
import { makeDeck, makeSettings } from '@/../test/fixtures';

let mockScopes: LocalStorageScopes<Repositories>;
jest.mock('./repositories', () => ({
  storageScopes: {
    current: () => mockScopes.current(),
    assertCurrent: (scope: unknown, revision?: number) =>
      mockScopes.assertCurrent(scope as ReturnType<typeof mockScopes.current>, revision),
    snapshot: () => mockScopes.snapshot(),
    subscribe: (listener: () => void) => mockScopes.subscribe(listener),
  },
}));

test('application commands and cached preferences stay scope-bound, including late results from prior screens', async () => {
  mockScopes = new LocalStorageScopes(async () => {
    const database = await RealSqliteDatabase.open();
    await runMigrations(database);
    return { database, value: createSqliteRepositories(database) };
  });
  await mockScopes.initialize();
  const guest = mockScopes.current();
  await guest.value.decks.create(makeDeck({ name: 'Guest data' }));
  await guest.value.settings.update(makeSettings({ theme: 'light' }));
  const guestRead = application.getDeck;
  const database = guest.database as RealSqliteDatabase;
  let complete: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const execute = database.execute.bind(database);
  jest.spyOn(database, 'execute').mockImplementation(async (sql, params) => {
    if (sql === 'SELECT * FROM decks WHERE id = ?') await gate;
    return execute(sql, params);
  });
  const late = guestRead('deck-1');
  await mockScopes.enterAccount('11111111-1111-1111-1111-111111111111');
  complete();
  await expect(late).rejects.toMatchObject({ code: 'unavailable' });
  await expect(async () => guestRead('deck-1')).rejects.toMatchObject({ code: 'unavailable' });
  await mockScopes.current().value.decks.create(makeDeck({ name: 'Private data' }));
  await mockScopes.current().value.settings.update(makeSettings({ theme: 'dark' }));
  expect(await application.getDeck('deck-1')).toMatchObject({ name: 'Private data' });
  expect(application.settings.snapshot()).toMatchObject({ theme: 'dark' });
  const accountRead = activeApplication().getDeck;
  const cachedAccount = activeApplication();
  await mockScopes.enterGuest();
  expect(await application.getDeck('deck-1')).toMatchObject({ name: 'Guest data' });
  expect(application.settings.snapshot()).toMatchObject({ theme: 'light' });
  await expect(async () => accountRead('deck-1')).rejects.toMatchObject({ code: 'unavailable' });
  await mockScopes.enterAccount('11111111-1111-1111-1111-111111111111');
  expect(activeApplication()).not.toBe(cachedAccount);
  await expect(async () => accountRead('deck-1')).rejects.toMatchObject({ code: 'unavailable' });
  expect(await application.getDeck('deck-1')).toMatchObject({ name: 'Private data' });
});
