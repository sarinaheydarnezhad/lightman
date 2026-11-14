import { localTime, type LocalTime, type LanguageTag } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import { SerialWork } from '@/core/application/serial-work';
import {
  NotificationPermissionDenied,
  ReminderRecoveryFailed,
  type NotificationPermissionState,
  type NotificationService,
} from '@/core/ports/notification';
import type { SettingsRepository } from '../domain/settings-repository';
import {
  validateUserSettings,
  type EnglishAccent,
  type ThemeMode,
  type UserSettings,
} from '../domain/user-settings';

const workByOwner = new WeakMap<object, SerialWork>();

/** All settings commands share invocation ordering, including initialization and effects. */
export function createSettingsUseCases(
  repository: SettingsRepository,
  notifications: NotificationService,
  assertCurrentOwner: () => void = () => {},
) {
  const scope = repository.mutationScope ?? repository;
  let work = workByOwner.get(scope);
  if (!work) {
    work = new SerialWork();
    workByOwner.set(scope, work);
  }
  function serialize<T>(action: () => Promise<T>): Promise<T> {
    return work!.run(async () => {
      assertCurrentOwner();
      return action();
    });
  }
  async function current(): Promise<UserSettings> {
    const value = await read();
    if (!value) throw new AppError('not-found', 'Settings not found.');
    return value;
  }
  async function read() {
    try {
      return await repository.get();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('persistence', 'Unable to load settings.', error);
    }
  }
  async function write(value: Partial<UserSettings>) {
    try {
      assertCurrentOwner();
      return await repository.update(value, assertCurrentOwner);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('persistence', 'Unable to save settings.', error);
    }
  }
  async function save(changes: Partial<UserSettings>): Promise<UserSettings> {
    await current();
    return write(changes);
  }
  async function syncReminder(
    enabled: boolean,
    time: UserSettings['dailyReminderTime'],
    language: string,
  ) {
    try {
      assertCurrentOwner();
      if (enabled) await notifications.scheduleDailyReminder(time!, language);
      else await notifications.cancelDailyReminder();
    } catch (error) {
      if (error instanceof NotificationPermissionDenied || error instanceof AppError) throw error;
      throw new AppError('unavailable', 'Unable to update the daily reminder.', error);
    }
  }
  async function reminder(changes: Partial<UserSettings>) {
    const previous = await current();
    const next = validateUserSettings({ ...previous, ...changes });
    if (next.dailyReminderEnabled) {
      let permission: NotificationPermissionState = await notifications.getPermissionStatus();
      assertCurrentOwner();
      if (!previous.dailyReminderEnabled && permission === 'notDetermined')
        permission = await notifications.requestPermission();
      if (permission === 'denied' || permission === 'notDetermined')
        throw new NotificationPermissionDenied();
      if (permission === 'unavailable')
        throw new AppError('unavailable', 'Notifications are unavailable on this device.');
    }
    try {
      await syncReminder(next.dailyReminderEnabled, next.dailyReminderTime, next.language);
    } catch (error) {
      if (error instanceof ReminderRecoveryFailed) {
        // Both native replacement and restoration failed. Keep the visible preference truthful.
        await write({ dailyReminderEnabled: false });
      }
      throw error;
    }
    try {
      return await write(changes);
    } catch (error) {
      try {
        await syncReminder(
          previous.dailyReminderEnabled,
          previous.dailyReminderTime,
          previous.language,
        );
      } catch {
        /* Preserve the repository failure; next action can retry synchronization. */
      }
      throw error;
    }
  }
  return {
    get: read,
    initialize: (defaults: UserSettings) =>
      serialize(async () => {
        const existing = await read();
        if (existing) return existing;
        const native = await notifications.getScheduledReminder();
        const permission = await notifications.getPermissionStatus();
        const restore = !!native && (permission === 'authorized' || permission === 'provisional');
        assertCurrentOwner();
        return repository.initialize(
          validateUserSettings({
            ...defaults,
            dailyReminderEnabled: restore,
            dailyReminderTime: restore ? native!.time : defaults.dailyReminderTime,
          }),
          assertCurrentOwner,
        );
      }),
    getReminderPermission: () => notifications.getPermissionStatus(),
    getScheduledReminder: () => notifications.getScheduledReminder(),
    snapshot: () => repository.snapshot(),
    subscribe: (listener: () => void) => repository.subscribe(listener),
    setTheme: (theme: ThemeMode) => serialize(() => save({ theme })),
    setLanguage: (language: UserSettings['language']) =>
      serialize(async () => {
        const value = await current();
        if (value.language === language) return value;
        return value.dailyReminderEnabled ? reminder({ language }) : save({ language });
      }),
    setHaptics: (hapticsEnabled: boolean) => serialize(() => save({ hapticsEnabled })),
    setSpeechLanguage: (preferredSpeechLanguage: LanguageTag) =>
      serialize(async () => {
        const accent =
          preferredSpeechLanguage.toLowerCase().split('-')[0] === 'en'
            ? (await current()).preferredSpeechAccent
            : null;
        return save({ preferredSpeechLanguage, preferredSpeechAccent: accent });
      }),
    setSpeechAccent: (preferredSpeechAccent: EnglishAccent | null) =>
      serialize(() => save({ preferredSpeechAccent })),
    setReminderEnabled: (enabled: boolean) =>
      serialize(async () => {
        const value = await current();
        if (value.dailyReminderEnabled === enabled) return value;
        return reminder({
          dailyReminderEnabled: enabled,
          dailyReminderTime: value.dailyReminderTime,
        });
      }),
    setReminderTime: (time: LocalTime) =>
      serialize(async () => {
        const value = await current();
        if (value.dailyReminderTime === time) return value;
        if (!value.dailyReminderEnabled) return save({ dailyReminderTime: localTime(time) });
        return reminder({
          dailyReminderEnabled: value.dailyReminderEnabled,
          dailyReminderTime: localTime(time),
        });
      }),
    openNotificationSettings: async () => {
      try {
        await notifications.openSystemSettings();
      } catch (error) {
        throw new AppError('unavailable', 'Unable to open device settings.', error);
      }
    },
    reconcileReminder: () =>
      serialize(async () => {
        const value = await current();
        const permission = await notifications.getPermissionStatus();
        if (
          value.dailyReminderEnabled &&
          (permission === 'authorized' || permission === 'provisional')
        ) {
          await syncReminder(true, value.dailyReminderTime, value.language);
        } else {
          await syncReminder(false, null, value.language);
          if (value.dailyReminderEnabled) await write({ dailyReminderEnabled: false });
        }
        return permission;
      }),
    update: (changes: Partial<UserSettings>) =>
      serialize(async () => {
        const value = await current();
        return 'dailyReminderEnabled' in changes ||
          'dailyReminderTime' in changes ||
          ('language' in changes && value.dailyReminderEnabled)
          ? reminder(changes)
          : save(changes);
      }),
  };
}
