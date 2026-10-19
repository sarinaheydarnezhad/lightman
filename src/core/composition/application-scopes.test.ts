import { LocalStorageScopes } from '@/core/storage/local-storage-scopes';
import type { Repositories } from '@/core/ports/repositories';
import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { runMigrations } from '@/core/database/migrations';
import { createSqliteRepositories } from './sqlite-repositories';
import { application, activeApplication } from './application';
import { makeDeck, makeSettings, sequenceIds } from '@/../test/fixtures';
import { idGenerator } from '@/core/infrastructure/platform';
import { expoNotificationService } from '@/core/infrastructure/expo-notification-service';

jest.mock('@/core/infrastructure/expo-notification-service', () => ({
  expoNotificationService: {
    getPermissionStatus: jest.fn().mockResolvedValue('authorized'),
    scheduleDailyReminder: jest.fn().mockResolvedValue(undefined),
    cancelDailyReminder: jest.fn().mockResolvedValue(undefined),
  },
}));

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
  jest.spyOn(idGenerator, 'create').mockImplementation(sequenceIds().create);
  mockScopes = new LocalStorageScopes(async () => {
    const database = await RealSqliteDatabase.open();
    await runMigrations(database);
    return { database, value: createSqliteRepositories(database) };
  });
  await mockScopes.initialize();
  const guest = mockScopes.current();
  await guest.value.decks.create(makeDeck({ name: 'Guest data' }));
  await guest.value.settings.update(makeSettings({ theme: 'light', dailyReminderEnabled: true }));
  await application.settings.reconcileReminder();
  expect(expoNotificationService.scheduleDailyReminder).toHaveBeenLastCalledWith('09:30', 'en', []);
  const card = await application.createCard({
    deckId: 'deck-1',
    frontText: 'Hello',
    meaning: 'Greeting',
    phonetic: null,
    category: null,
    examples: [],
  });
  expect(expoNotificationService.scheduleDailyReminder).toHaveBeenLastCalledWith(
    '09:30',
    'en',
    expect.arrayContaining([expect.objectContaining({ dueCount: 1 })]),
  );
  await application.archiveCard(card.id);
  expect(expoNotificationService.scheduleDailyReminder).toHaveBeenLastCalledWith('09:30', 'en', []);
  jest
    .mocked(expoNotificationService.scheduleDailyReminder)
    .mockRejectedValueOnce(new Error('Native unavailable'));
  const saved = await application.createCard({
    deckId: 'deck-1',
    frontText: 'Saved',
    meaning: 'Despite notification failure',
    phonetic: null,
    category: null,
    examples: [],
  });
  expect(await application.getCard(saved.id)).toMatchObject({ frontText: 'Saved' });
  expect(expoNotificationService.cancelDailyReminder).toHaveBeenCalled();
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
  expect(expoNotificationService.cancelDailyReminder).toHaveBeenCalled();
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
