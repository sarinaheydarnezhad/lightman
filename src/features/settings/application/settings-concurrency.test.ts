import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { makeSettings } from '@/../test/fixtures';
import { runMigrations } from '@/core/database/migrations';
import { languageTag, localTime } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import type { NotificationService } from '@/core/ports/notification';
import {
  SQLiteSettingsRepository,
  initializeSettingsDefaults,
} from '../data/sqlite-settings-repository';
import {
  DeviceLanguagePreference,
  DeviceLanguageSettingsRepository,
} from '../data/device-language-settings-repository';
import { createSettingsUseCases } from './create-settings-use-cases';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const databases: RealSqliteDatabase[] = [];
afterEach(() => {
  databases.splice(0).forEach((db) => db.handle.close());
});

async function setup(seed = true) {
  const db = await RealSqliteDatabase.open();
  databases.push(db);
  await runMigrations(db);
  const repository = new SQLiteSettingsRepository(db);
  if (seed) await repository.update(makeSettings({ theme: 'light', hapticsEnabled: true }));
  const notifications: jest.Mocked<NotificationService> = {
    getPermissionStatus: jest.fn().mockResolvedValue('authorized'),
    requestPermission: jest.fn().mockResolvedValue('authorized'),
    getScheduledReminder: jest.fn().mockResolvedValue(null),
    scheduleDailyReminder: jest.fn().mockResolvedValue(undefined),
    cancelDailyReminder: jest.fn().mockResolvedValue(undefined),
    openSystemSettings: jest.fn().mockResolvedValue(undefined),
    subscribeToReminderTaps: jest.fn().mockReturnValue(() => {}),
    consumeLastReminderTap: jest.fn().mockReturnValue(false),
  };
  return {
    db,
    repository,
    notifications,
    settings: createSettingsUseCases(repository, notifications),
  };
}

test.each([false, true])(
  'audit setters preserve both fields, reverse invocation=%s',
  async (reverse) => {
    const { db, settings } = await setup();
    const actions = [() => settings.setTheme('dark'), () => settings.setHaptics(false)];
    if (reverse) actions.reverse();
    await Promise.all(actions.map((action) => action()));
    expect(settings.snapshot()).toMatchObject({ theme: 'dark', hapticsEnabled: false });
    expect((await db.execute('SELECT theme,haptics_enabled FROM user_settings')).rows[0]).toEqual({
      theme: 'dark',
      haptics_enabled: 0,
    });
  },
);

test('four independent preferences commit and survive an exported/reopened database', async () => {
  const { db, settings } = await setup();
  await Promise.all([
    settings.setTheme('dark'),
    settings.setHaptics(false),
    settings.setLanguage(languageTag('fa')),
    settings.setSpeechAccent('uk'),
  ]);
  const reopened = await RealSqliteDatabase.open(db.handle.export());
  databases.push(reopened);
  expect(await new SQLiteSettingsRepository(reopened).get()).toMatchObject({
    theme: 'dark',
    hapticsEnabled: false,
    language: 'fa',
    preferredSpeechAccent: 'uk',
  });
});

test('same-field and general changes follow invocation order across independent application instances', async () => {
  const { db, repository, notifications, settings } = await setup();
  const other = createSettingsUseCases(new SQLiteSettingsRepository(db), notifications);
  await Promise.all([
    settings.setTheme('dark'),
    other.update({ theme: 'light', hapticsEnabled: false }),
    settings.setTheme('dark'),
  ]);
  expect(await repository.get()).toMatchObject({ theme: 'dark', hapticsEnabled: false });
  expect(other.snapshot()).toBe(settings.snapshot());
});

test('general update and specific update preserve unrelated committed fields', async () => {
  const { settings } = await setup();
  await Promise.all([
    settings.update({ language: languageTag('fa'), theme: 'dark' }),
    settings.setHaptics(false),
  ]);
  expect(settings.snapshot()).toMatchObject({
    theme: 'dark',
    hapticsEnabled: false,
    language: 'fa',
  });
});

test('slow reminder reconciliation cannot publish its old snapshot over a queued user edit', async () => {
  const { repository, notifications, settings } = await setup();
  await repository.update({ dailyReminderEnabled: true });
  const entered = deferred(),
    release = deferred();
  notifications.getPermissionStatus.mockImplementationOnce(async () => {
    entered.resolve();
    await release.promise;
    return 'denied';
  });
  const reconcile = settings.reconcileReminder();
  await entered.promise;
  const edit = settings.update({ theme: 'dark', dailyReminderEnabled: false });
  release.resolve();
  await Promise.all([reconcile, edit]);
  expect(await repository.get()).toMatchObject({ theme: 'dark', dailyReminderEnabled: false });
});

test('external effects never hold a database transaction; later commands wait without starting stale effects', async () => {
  const { db, settings, notifications } = await setup();
  const entered = deferred(),
    release = deferred();
  notifications.scheduleDailyReminder.mockImplementationOnce(async () => {
    entered.resolve();
    await release.promise;
  });
  const enable = settings.setReminderEnabled(true);
  await entered.promise;
  const disable = settings.setReminderEnabled(false);
  expect(notifications.cancelDailyReminder).not.toHaveBeenCalled();
  await db.transaction(async (transaction) => {
    expect(
      (await transaction.execute('SELECT daily_reminder_enabled FROM user_settings')).rows[0]
        ?.daily_reminder_enabled,
    ).toBe(0);
  });
  release.resolve();
  await Promise.all([enable, disable]);
  expect(settings.snapshot()?.dailyReminderEnabled).toBe(false);
  expect(notifications.cancelDailyReminder).toHaveBeenCalledTimes(1);
});

test('an external direct repository patch during scheduling is retained by the reminder commit', async () => {
  const { repository, settings, notifications } = await setup();
  const entered = deferred(),
    release = deferred();
  notifications.scheduleDailyReminder.mockImplementationOnce(async () => {
    entered.resolve();
    await release.promise;
  });
  const enable = settings.setReminderEnabled(true);
  await entered.promise;
  await repository.update({ theme: 'dark' });
  release.resolve();
  expect(await enable).toMatchObject({ theme: 'dark', dailyReminderEnabled: true });
});

test('database failure rolls back settings and outbox; retry and both queues recover', async () => {
  const { db, repository, settings } = await setup();
  const before = (await db.execute('SELECT * FROM sync_operations')).rows;
  db.failStatement = 'INSERT INTO user_settings';
  await expect(settings.setTheme('dark')).rejects.toMatchObject({ code: 'persistence' });
  expect(settings.snapshot()?.theme).toBe('light');
  expect((await db.execute('SELECT * FROM sync_operations')).rows).toEqual(before);
  db.failStatement = null;
  await Promise.all([settings.setHaptics(false), settings.setTheme('dark')]);
  expect(await repository.get()).toMatchObject({ theme: 'dark', hapticsEnabled: false });
});

test('failed side effects do not poison subsequent independent or reminder commands', async () => {
  const { settings, notifications } = await setup();
  notifications.scheduleDailyReminder.mockRejectedValueOnce(new Error('platform failure'));
  const failure = expect(settings.setReminderEnabled(true)).rejects.toMatchObject({
    code: 'unavailable',
  });
  const theme = settings.setTheme('dark');
  await Promise.all([failure, theme]);
  expect(settings.snapshot()).toMatchObject({ theme: 'dark', dailyReminderEnabled: false });
  await settings.setReminderEnabled(true);
  expect(settings.snapshot()?.dailyReminderEnabled).toBe(true);
});

test('a delayed read publishes before its following commit, never after it', async () => {
  const { db, repository } = await setup();
  const entered = deferred(),
    release = deferred();
  const execute = db.execute.bind(db);
  jest.spyOn(db, 'execute').mockImplementationOnce(async (sql, params) => {
    const result = await execute(sql, params);
    entered.resolve();
    await release.promise;
    return result;
  });
  const snapshots: string[] = [];
  repository.subscribe(() => snapshots.push(repository.snapshot()!.theme));
  const read = repository.get();
  await entered.promise;
  const write = repository.update({ theme: 'dark' });
  release.resolve();
  await Promise.all([read, write]);
  expect(snapshots.at(-1)).toBe('dark');
  expect(repository.snapshot()?.theme).toBe('dark');
});

test('initialization participates in command ordering and never overwrites the following preference', async () => {
  const { settings, notifications } = await setup(false);
  const entered = deferred(),
    release = deferred();
  notifications.getScheduledReminder.mockImplementationOnce(async () => {
    entered.resolve();
    await release.promise;
    return null;
  });
  const initialize = settings.initialize(makeSettings());
  await entered.promise;
  const edit = settings.setTheme('dark');
  release.resolve();
  await Promise.all([initialize, edit]);
  expect(settings.snapshot()?.theme).toBe('dark');
  await settings.initialize(makeSettings({ theme: 'light' }));
  expect(settings.snapshot()?.theme).toBe('dark');
});

test('default insertion racing an explicit repository patch cannot overwrite it', async () => {
  const { db, repository } = await setup(false);
  await Promise.all([
    initializeSettingsDefaults(db, makeSettings()),
    repository.update({ theme: 'dark' }),
  ]);
  expect(await repository.get()).toMatchObject({ theme: 'dark' });
});

test('an explicit row created while initialization waits is retained instead of being replaced by defaults', async () => {
  const { settings, repository, notifications } = await setup(false);
  const entered = deferred(),
    release = deferred();
  notifications.getScheduledReminder.mockImplementationOnce(async () => {
    entered.resolve();
    await release.promise;
    return null;
  });
  const initialize = settings.initialize(makeSettings());
  await entered.promise;
  await repository.update(makeSettings({ theme: 'dark', hapticsEnabled: false }));
  release.resolve();
  expect(await initialize).toMatchObject({ theme: 'dark', hapticsEnabled: false });
});

test('owner change rejects delayed and queued writes without publishing into a different owner', async () => {
  const guest = await setup(),
    account = await setup();
  let current = true;
  const settings = createSettingsUseCases(guest.repository, guest.notifications, () => {
    if (!current) throw new AppError('unavailable', 'Owner changed');
  });
  const entered = deferred(),
    release = deferred();
  guest.notifications.scheduleDailyReminder.mockImplementationOnce(async () => {
    entered.resolve();
    await release.promise;
  });
  const enable = settings.setReminderEnabled(true);
  const rejected = expect(enable).rejects.toMatchObject({ code: 'unavailable' });
  await entered.promise;
  const queued = expect(settings.setTheme('dark')).rejects.toMatchObject({ code: 'unavailable' });
  current = false;
  await account.settings.setTheme('dark');
  release.resolve();
  await Promise.all([rejected, queued]);
  expect(await guest.repository.get()).toMatchObject({
    theme: 'light',
    dailyReminderEnabled: false,
  });
  expect(await account.repository.get()).toMatchObject({
    theme: 'dark',
    dailyReminderEnabled: false,
  });
});

test('separate guest/account queues make progress independently while one owner has a delayed effect', async () => {
  const guest = await setup(),
    account = await setup();
  const entered = deferred(),
    release = deferred();
  guest.notifications.scheduleDailyReminder.mockImplementationOnce(async () => {
    entered.resolve();
    await release.promise;
  });
  const enable = guest.settings.setReminderEnabled(true);
  await entered.promise;
  await account.settings.setHaptics(false);
  expect(account.settings.snapshot()?.hapticsEnabled).toBe(false);
  expect(guest.settings.snapshot()?.hapticsEnabled).toBe(true);
  release.resolve();
  await enable;
});

test('device language is not rewritten by unrelated account preference updates', async () => {
  const { db, repository, notifications } = await setup();
  const preference = new DeviceLanguagePreference();
  await preference.initialize(db, languageTag('en'));
  const wrapped = new DeviceLanguageSettingsRepository(repository, preference);
  const settings = createSettingsUseCases(wrapped, notifications);
  await settings.setLanguage(languageTag('fa'));
  await repository.update({ language: languageTag('en') }); // remote account preference
  await Promise.all([settings.setTheme('dark'), settings.setHaptics(false)]);
  expect(preference.snapshot()).toBe('fa');
  expect(settings.snapshot()).toMatchObject({
    language: 'fa',
    theme: 'dark',
    hapticsEnabled: false,
  });
});

test('generic language updates still reconcile an enabled reminder', async () => {
  const { settings, notifications } = await setup();
  await settings.setReminderEnabled(true);
  await settings.update({ language: languageTag('fa'), dailyReminderTime: localTime('18:00') });
  expect(notifications.scheduleDailyReminder).toHaveBeenLastCalledWith('18:00', 'fa');
});

test('owner change during a permission check prevents a late permission prompt or scheduling', async () => {
  const { repository, notifications } = await setup();
  let current = true;
  const settings = createSettingsUseCases(repository, notifications, () => {
    if (!current) throw new AppError('unavailable', 'Owner changed');
  });
  const entered = deferred(),
    release = deferred();
  notifications.getPermissionStatus.mockImplementationOnce(async () => {
    entered.resolve();
    await release.promise;
    return 'notDetermined';
  });
  const pending = expect(settings.setReminderEnabled(true)).rejects.toMatchObject({
    code: 'unavailable',
  });
  await entered.promise;
  current = false;
  release.resolve();
  await pending;
  expect(notifications.requestPermission).not.toHaveBeenCalled();
  expect(notifications.scheduleDailyReminder).not.toHaveBeenCalled();
  expect(repository.snapshot()?.dailyReminderEnabled).toBe(false);
});

test('bounded queue rejects excess work and recovers after draining', async () => {
  const { settings, notifications } = await setup();
  const entered = deferred(),
    release = deferred();
  notifications.scheduleDailyReminder.mockImplementationOnce(async () => {
    entered.resolve();
    await release.promise;
  });
  const first = settings.setReminderEnabled(true);
  await entered.promise;
  const pending = Array.from({ length: 127 }, () => settings.setTheme('dark'));
  await expect(settings.setHaptics(false)).rejects.toMatchObject({ code: 'unavailable' });
  release.resolve();
  await Promise.all([first, ...pending]);
  await settings.setHaptics(false);
  expect(settings.snapshot()?.hapticsEnabled).toBe(false);
});
