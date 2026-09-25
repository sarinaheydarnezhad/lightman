import { languageTag, localTime } from '@/core/domain/values';
import {
  NotificationPermissionDenied,
  ReminderRecoveryFailed,
  type NotificationService,
} from '@/core/ports/notification';
import { defaultSettings } from '@/core/composition/default-settings';
import { createHapticFeedbackService } from '@/core/infrastructure/haptic-feedback';
import { InMemorySettingsRepository } from '../data/development-in-memory-settings-repository';
import { createSettingsUseCases } from './create-settings-use-cases';

function setup() {
  const repository = new InMemorySettingsRepository();
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
  return { repository, notifications, settings: createSettingsUseCases(repository, notifications) };
}

test('documented defaults are valid and observable without a duplicate store', async () => {
  const { repository, settings } = setup();
  const listener = jest.fn();
  const unsubscribe = settings.subscribe(listener);
  await repository.update(defaultSettings());
  expect(settings.snapshot()).toMatchObject({
    theme: 'system',
    hapticsEnabled: true,
    dailyReminderEnabled: false,
    dailyReminderTime: '09:00',
    preferredSpeechLanguage: 'en',
    preferredSpeechAccent: null,
  });
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
});

test('UI language saves independently of speech and replaces an active localized reminder atomically', async () => {
  const { repository, notifications, settings } = setup();
  await repository.update(defaultSettings());
  await settings.setLanguage(languageTag('fa'));
  expect(settings.snapshot()).toMatchObject({ language: 'fa', preferredSpeechLanguage: 'en' });
  expect(notifications.scheduleDailyReminder).not.toHaveBeenCalled();
  await settings.setReminderEnabled(true);
  expect(notifications.scheduleDailyReminder).toHaveBeenLastCalledWith('09:00', 'fa');
  notifications.scheduleDailyReminder.mockRejectedValueOnce(new Error('native failure'));
  await expect(settings.setLanguage(languageTag('ar'))).rejects.toMatchObject({
    code: 'unavailable',
  });
  expect(settings.snapshot()?.language).toBe('fa');
  await settings.setLanguage(languageTag('ar'));
  expect(notifications.scheduleDailyReminder).toHaveBeenLastCalledWith('09:00', 'ar');
  expect(settings.snapshot()?.language).toBe('ar');
});

test('theme, haptics and speech writes update the repository and dependent service reads immediately', async () => {
  const { repository, settings } = setup();
  await repository.update(defaultSettings());
  const perform = jest.fn().mockResolvedValue(undefined);
  const haptics = createHapticFeedbackService(
    async () => (await settings.get())!.hapticsEnabled,
    perform,
  );
  await settings.setTheme('oled');
  expect(settings.snapshot()?.theme).toBe('oled');
  await settings.setHaptics(false);
  await haptics.cardReveal();
  expect(perform).not.toHaveBeenCalled();
  await settings.setHaptics(true);
  await haptics.cardReveal();
  expect(perform).toHaveBeenCalledTimes(1);
  await settings.setSpeechLanguage(languageTag('en'));
  await settings.setSpeechAccent('uk');
  expect(settings.snapshot()?.preferredSpeechAccent).toBe('uk');
  await settings.setSpeechLanguage(languageTag('fa'));
  expect(settings.snapshot()).toMatchObject({
    preferredSpeechLanguage: 'fa',
    preferredSpeechAccent: null,
  });
  await expect(settings.setSpeechAccent('us')).rejects.toThrow();
  expect(settings.snapshot()?.preferredSpeechAccent).toBeNull();
});

test('reminder schedules first, commits after success, reschedules on time change and cancels when off', async () => {
  const { repository, notifications, settings } = setup();
  await repository.update(defaultSettings());
  notifications.scheduleDailyReminder.mockImplementationOnce(async () => {
    expect(settings.snapshot()?.dailyReminderEnabled).toBe(false);
  });
  await settings.setReminderEnabled(true);
  expect(settings.snapshot()?.dailyReminderEnabled).toBe(true);
  await settings.setReminderTime(localTime('18:45'));
  expect(notifications.scheduleDailyReminder).toHaveBeenLastCalledWith('18:45', 'en');
  expect(settings.snapshot()?.dailyReminderTime).toBe('18:45');
  await settings.setReminderEnabled(false);
  expect(notifications.cancelDailyReminder).toHaveBeenCalledTimes(1);
  expect(settings.snapshot()?.dailyReminderEnabled).toBe(false);
});

test('permission denial or scheduling failure never claims a reminder is enabled', async () => {
  const { repository, notifications, settings } = setup();
  await repository.update(defaultSettings());
  notifications.scheduleDailyReminder.mockRejectedValueOnce(new NotificationPermissionDenied());
  await expect(settings.setReminderEnabled(true)).rejects.toBeInstanceOf(
    NotificationPermissionDenied,
  );
  expect(settings.snapshot()?.dailyReminderEnabled).toBe(false);
  notifications.scheduleDailyReminder.mockRejectedValueOnce(new Error('native failure'));
  await expect(settings.setReminderEnabled(true)).rejects.toMatchObject({ code: 'unavailable' });
  expect(settings.snapshot()?.dailyReminderEnabled).toBe(false);
});

test('enabling requests permission only when undetermined; denied never prompts again', async () => {
  const { repository, notifications, settings } = setup();
  await repository.update(defaultSettings());
  notifications.getPermissionStatus.mockResolvedValueOnce('notDetermined');
  notifications.requestPermission.mockResolvedValueOnce('provisional');
  await settings.setReminderEnabled(true);
  expect(notifications.requestPermission).toHaveBeenCalledTimes(1);
  await settings.setReminderEnabled(false);
  notifications.getPermissionStatus.mockResolvedValueOnce('denied');
  await expect(settings.setReminderEnabled(true)).rejects.toBeInstanceOf(
    NotificationPermissionDenied,
  );
  expect(notifications.requestPermission).toHaveBeenCalledTimes(1);
  expect(settings.snapshot()?.dailyReminderEnabled).toBe(false);
});

test('reconciliation reschedules a missing enabled reminder, without permission prompts or duplicate writes', async () => {
  const { repository, notifications, settings } = setup();
  await repository.update({ ...defaultSettings(), dailyReminderEnabled: true });
  notifications.getScheduledReminder.mockResolvedValueOnce(null);
  await settings.reconcileReminder();
  expect(notifications.scheduleDailyReminder).toHaveBeenCalledWith(localTime('09:00'), 'en');
  expect(notifications.requestPermission).not.toHaveBeenCalled();
  expect(settings.snapshot()?.dailyReminderEnabled).toBe(true);
});

test('reconciliation turns off a reminder after permission is revoked', async () => {
  const { repository, notifications, settings } = setup();
  await repository.update({ ...defaultSettings(), dailyReminderEnabled: true });
  notifications.getPermissionStatus.mockResolvedValueOnce('denied');
  expect(await settings.reconcileReminder()).toBe('denied');
  expect(notifications.cancelDailyReminder).toHaveBeenCalledTimes(1);
  expect(settings.snapshot()?.dailyReminderEnabled).toBe(false);
  expect(notifications.requestPermission).not.toHaveBeenCalled();
});

test('if native replacement and restoration both fail, the preference is disabled', async () => {
  const { repository, notifications, settings } = setup();
  await repository.update({ ...defaultSettings(), dailyReminderEnabled: true });
  notifications.scheduleDailyReminder.mockRejectedValueOnce(new ReminderRecoveryFailed());
  await expect(settings.setReminderTime(localTime('20:00'))).rejects.toBeInstanceOf(
    ReminderRecoveryFailed,
  );
  expect(settings.snapshot()?.dailyReminderEnabled).toBe(false);
});

test('repository failure rolls back a scheduled reminder', async () => {
  const { repository, notifications, settings } = setup();
  await repository.update(defaultSettings());
  jest.spyOn(repository, 'update').mockRejectedValueOnce(new Error('disk failure'));
  await expect(settings.setReminderEnabled(true)).rejects.toThrow();
  expect(notifications.cancelDailyReminder).toHaveBeenCalledTimes(1);
  expect(settings.snapshot()?.dailyReminderEnabled).toBe(false);
});

test('rapid reminder actions serialize and converge on the last request', async () => {
  const { repository, notifications, settings } = setup();
  await repository.update(defaultSettings());
  const first = settings.setReminderEnabled(true);
  const second = settings.setReminderEnabled(false);
  const third = settings.setReminderEnabled(true);
  await Promise.all([first, second, third]);
  expect(settings.snapshot()?.dailyReminderEnabled).toBe(true);
  expect(notifications.scheduleDailyReminder).toHaveBeenCalledTimes(2);
  expect(notifications.cancelDailyReminder).toHaveBeenCalledTimes(1);
});

test('generic application updates cannot bypass reminder scheduling', async () => {
  const { repository, notifications, settings } = setup();
  await repository.update(defaultSettings());
  await settings.update({ dailyReminderEnabled: true, theme: 'dark' });
  expect(notifications.scheduleDailyReminder).toHaveBeenCalledWith(localTime('09:00'), 'en');
  expect(settings.snapshot()).toMatchObject({ dailyReminderEnabled: true, theme: 'dark' });
});

test('startup synchronization cancels orphaned native reminders when the session default is off', async () => {
  const { repository, notifications, settings } = setup();
  await repository.update(defaultSettings());
  await settings.reconcileReminder();
  expect(notifications.cancelDailyReminder).toHaveBeenCalledTimes(1);
  expect(settings.snapshot()?.dailyReminderEnabled).toBe(false);
});

test('cold startup restores an existing native reminder before seeding default settings', async () => {
  const { settings, notifications } = setup();
  notifications.getScheduledReminder.mockResolvedValueOnce({ time: localTime('18:45') });
  expect(await settings.initialize(defaultSettings())).toMatchObject({
    dailyReminderEnabled: true,
    dailyReminderTime: '18:45',
  });
  await settings.reconcileReminder();
  expect(settings.snapshot()?.dailyReminderEnabled).toBe(true);
  expect(notifications.cancelDailyReminder).not.toHaveBeenCalled();
  expect(notifications.requestPermission).not.toHaveBeenCalled();
});

test('invalid settings and repository failures leave preferences unchanged', async () => {
  const { repository, settings } = setup();
  await repository.update(defaultSettings());
  await expect(settings.setReminderTime('29:99' as never)).rejects.toThrow();
  await expect(settings.setTheme('magenta' as never)).rejects.toThrow();
  jest.spyOn(repository, 'update').mockRejectedValueOnce(new Error('disk failure'));
  await expect(settings.setHaptics(false)).rejects.toThrow();
  expect(settings.snapshot()?.hapticsEnabled).toBe(true);
});
