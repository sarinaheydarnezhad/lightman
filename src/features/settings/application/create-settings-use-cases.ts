import { localTime, type LocalTime, type LanguageTag } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
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

/** Writes serialize per preference; only reminder effects are transactional. */
export function createSettingsUseCases(
  repository: SettingsRepository,
  notifications: NotificationService,
) {
  const pending = new Map<string, Promise<unknown>>();
  function serialize<T>(key: string, action: () => Promise<T>): Promise<T> {
    const before = pending.get(key) ?? Promise.resolve();
    const result = before.then(action, action);
    pending.set(key, result);
    void result
      .finally(() => {
        if (pending.get(key) === result) pending.delete(key);
      })
      .catch(() => {});
    return result;
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
  async function write(value: UserSettings) {
    try {
      return await repository.update(value);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('persistence', 'Unable to save settings.', error);
    }
  }
  async function save(changes: Partial<UserSettings>): Promise<UserSettings> {
    return write(validateUserSettings({ ...(await current()), ...changes }));
  }
  async function syncReminder(enabled: boolean, time: UserSettings['dailyReminderTime']) {
    try {
      if (enabled) await notifications.scheduleDailyReminder(time!);
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
      if (!previous.dailyReminderEnabled && permission === 'notDetermined')
        permission = await notifications.requestPermission();
      if (permission === 'denied' || permission === 'notDetermined')
        throw new NotificationPermissionDenied();
      if (permission === 'unavailable')
        throw new AppError('unavailable', 'Notifications are unavailable on this device.');
    }
    try {
      await syncReminder(next.dailyReminderEnabled, next.dailyReminderTime);
    } catch (error) {
      if (error instanceof ReminderRecoveryFailed) {
        // Both native replacement and restoration failed. Keep the visible preference truthful.
        await write({ ...previous, dailyReminderEnabled: false });
      }
      throw error;
    }
    try {
      return await write(next);
    } catch (error) {
      try {
        await syncReminder(previous.dailyReminderEnabled, previous.dailyReminderTime);
      } catch {
        /* Preserve the repository failure; next action can retry synchronization. */
      }
      throw error;
    }
  }
  return {
    get: read,
    initialize: async (defaults: UserSettings) => {
      const existing = await read();
      if (existing) return existing;
      const native = await notifications.getScheduledReminder();
      const permission = await notifications.getPermissionStatus();
      const restore = !!native && (permission === 'authorized' || permission === 'provisional');
      return write(
        validateUserSettings({
          ...defaults,
          dailyReminderEnabled: restore,
          dailyReminderTime: restore ? native!.time : defaults.dailyReminderTime,
        }),
      );
    },
    getReminderPermission: () => notifications.getPermissionStatus(),
    getScheduledReminder: () => notifications.getScheduledReminder(),
    snapshot: () => repository.snapshot(),
    subscribe: (listener: () => void) => repository.subscribe(listener),
    setTheme: (theme: ThemeMode) => serialize('theme', () => save({ theme })),
    setHaptics: (hapticsEnabled: boolean) => serialize('haptics', () => save({ hapticsEnabled })),
    setSpeechLanguage: (preferredSpeechLanguage: LanguageTag) =>
      serialize('speech', async () => {
        const accent =
          preferredSpeechLanguage.toLowerCase().split('-')[0] === 'en'
            ? (await current()).preferredSpeechAccent
            : null;
        return save({ preferredSpeechLanguage, preferredSpeechAccent: accent });
      }),
    setSpeechAccent: (preferredSpeechAccent: EnglishAccent | null) =>
      serialize('speech', () => save({ preferredSpeechAccent })),
    setReminderEnabled: (enabled: boolean) =>
      serialize('reminder', async () => {
        const value = await current();
        if (value.dailyReminderEnabled === enabled) return value;
        return reminder({
          dailyReminderEnabled: enabled,
          dailyReminderTime: value.dailyReminderTime,
        });
      }),
    setReminderTime: (time: LocalTime) =>
      serialize('reminder', async () => {
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
      serialize('reminder', async () => {
        const value = await current();
        const permission = await notifications.getPermissionStatus();
        if (
          value.dailyReminderEnabled &&
          (permission === 'authorized' || permission === 'provisional')
        ) {
          await syncReminder(true, value.dailyReminderTime);
        } else {
          await syncReminder(false, null);
          if (value.dailyReminderEnabled) await write({ ...value, dailyReminderEnabled: false });
        }
        return permission;
      }),
    update: (changes: Partial<UserSettings>) =>
      'dailyReminderEnabled' in changes || 'dailyReminderTime' in changes
        ? serialize('reminder', () => reminder(changes))
        : serialize('general', () => save(changes)),
  };
}
