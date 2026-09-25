import { Linking, Platform } from 'react-native';
import {
  addNotificationResponseReceivedListener,
  cancelScheduledNotificationAsync,
  clearLastNotificationResponse,
  getAllScheduledNotificationsAsync,
  getLastNotificationResponse,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { localTime } from '@/core/domain/values';
import { NotificationPermissionDenied, ReminderRecoveryFailed } from '@/core/ports/notification';
import { expoNotificationService } from './expo-notification-service';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  DEFAULT_ACTION_IDENTIFIER: 'default',
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponse: jest.fn(),
  clearLastNotificationResponse: jest.fn(),
}));

const existing = jest.mocked(getAllScheduledNotificationsAsync);
const permissions = jest.mocked(getPermissionsAsync);
const request = jest.mocked(requestPermissionsAsync);
const schedule = jest.mocked(scheduleNotificationAsync);
const cancel = jest.mocked(cancelScheduledNotificationAsync);
const lastResponse = jest.mocked(getLastNotificationResponse);
const tapListener = jest.mocked(addNotificationResponseReceivedListener);
const foregroundHandler = jest.mocked(setNotificationHandler).mock.calls[0]![0];

function reminder(id: string, time = '09:00', owned = true) {
  const [hour, minute] = time.split(':').map(Number);
  return {
    identifier: id,
    content: {
      title: 'Time to study',
      body: 'You have cards waiting for review.',
      data: { reminderKey: owned ? 'lightman.daily-study-reminder' : 'other', uiLanguage: 'en' },
    },
    trigger: { type: 'daily', hour, minute },
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  permissions.mockResolvedValue({ granted: true, status: 'granted' } as never);
  existing.mockResolvedValue([]);
  schedule.mockResolvedValue('new-reminder');
  cancel.mockResolvedValue();
  lastResponse.mockReturnValue(null);
  tapListener.mockReturnValue({ remove: jest.fn() } as never);
});

test('permission states distinguish Android and all supported iOS outcomes', async () => {
  permissions.mockResolvedValueOnce({ granted: false, status: 'undetermined' } as never);
  expect(await expoNotificationService.getPermissionStatus()).toBe('notDetermined');
  permissions.mockResolvedValueOnce({ granted: false, status: 'denied' } as never);
  expect(await expoNotificationService.getPermissionStatus()).toBe('denied');
  jest.replaceProperty(Platform, 'OS', 'ios');
  for (const [native, expected] of [
    [0, 'notDetermined'],
    [1, 'denied'],
    [2, 'authorized'],
    [3, 'provisional'],
    [4, 'authorized'],
  ] as const) {
    permissions.mockResolvedValueOnce({ granted: false, ios: { status: native } } as never);
    expect(await expoNotificationService.getPermissionStatus()).toBe(expected);
  }
});

test('requests only an undetermined permission and accepts provisional approval', async () => {
  permissions.mockResolvedValueOnce({ granted: false, status: 'undetermined' } as never);
  request.mockResolvedValueOnce({ granted: true, status: 'granted' } as never);
  expect(await expoNotificationService.requestPermission()).toBe('authorized');
  expect(request).toHaveBeenCalledTimes(1);
  permissions.mockResolvedValueOnce({ granted: false, status: 'denied' } as never);
  expect(await expoNotificationService.requestPermission()).toBe('denied');
  expect(request).toHaveBeenCalledTimes(1);
  jest.replaceProperty(Platform, 'OS', 'ios');
  permissions.mockResolvedValueOnce({ granted: false, ios: { status: 3 } } as never);
  expect(await expoNotificationService.requestPermission()).toBe('provisional');
});

test('schedules one silent local daily reminder and reads its local time', async () => {
  await expoNotificationService.scheduleDailyReminder(localTime('07:25'));
  expect(schedule).toHaveBeenCalledWith(
    expect.objectContaining({
      content: expect.objectContaining({
        title: 'Time to study',
        body: 'You have cards waiting for review.',
        sound: false,
      }),
      trigger: expect.objectContaining({ type: 'daily', hour: 7, minute: 25 }),
    }),
  );
  existing.mockResolvedValueOnce([
    reminder('ours', '07:25'),
    reminder('unrelated', '12:00', false),
  ]);
  expect(await expoNotificationService.getScheduledReminder()).toEqual({ time: '07:25' });
});

test('localizes reminder content from app language and replaces old-language native schedule', async () => {
  await expoNotificationService.scheduleDailyReminder(localTime('09:00'), 'fa');
  expect(schedule).toHaveBeenCalledWith(
    expect.objectContaining({
      content: expect.objectContaining({
        title: 'وقت مطالعه است',
        data: expect.objectContaining({ uiLanguage: 'fa' }),
      }),
    }),
  );
  existing.mockResolvedValueOnce([reminder('old-english', '09:00')]);
  await expoNotificationService.scheduleDailyReminder(localTime('09:00'), 'ar');
  expect(cancel).toHaveBeenCalledWith('old-english');
  expect(schedule).toHaveBeenLastCalledWith(
    expect.objectContaining({
      content: expect.objectContaining({
        title: 'حان وقت الدراسة',
        data: expect.objectContaining({ uiLanguage: 'ar' }),
      }),
    }),
  );
});

test('replaces old reminder before scheduling, preserves unrelated alerts, and avoids duplicates', async () => {
  existing.mockResolvedValueOnce([reminder('old'), reminder('unrelated', '12:00', false)]);
  await expoNotificationService.scheduleDailyReminder(localTime('18:45'));
  expect(cancel).toHaveBeenCalledWith('old');
  expect(cancel).not.toHaveBeenCalledWith('unrelated');
  expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(schedule.mock.invocationCallOrder[0]!);
  existing.mockResolvedValueOnce([reminder('new-reminder', '18:45')]);
  await expoNotificationService.scheduleDailyReminder(localTime('18:45'));
  expect(schedule).toHaveBeenCalledTimes(1);
  existing.mockResolvedValueOnce([
    reminder('duplicate-1', '18:45'),
    reminder('duplicate-2', '18:45'),
  ]);
  await expoNotificationService.scheduleDailyReminder(localTime('18:45'));
  expect(cancel).toHaveBeenCalledWith('duplicate-1');
  expect(cancel).toHaveBeenCalledWith('duplicate-2');
  expect(schedule).toHaveBeenCalledTimes(2);
});

test('denial, invalid time, and native errors never create a new reminder', async () => {
  permissions.mockResolvedValueOnce({ granted: false, status: 'denied' } as never);
  await expect(
    expoNotificationService.scheduleDailyReminder(localTime('09:00')),
  ).rejects.toBeInstanceOf(NotificationPermissionDenied);
  await expect(
    expoNotificationService.scheduleDailyReminder('24:00' as never),
  ).rejects.toMatchObject({ code: 'validation' });
  expect(schedule).not.toHaveBeenCalled();
});

test('failed replacement restores old schedule, or reports lost schedule if restoration fails', async () => {
  existing.mockResolvedValueOnce([reminder('old')]);
  schedule.mockRejectedValueOnce(new Error('native failed'));
  await expect(expoNotificationService.scheduleDailyReminder(localTime('20:00'))).rejects.toThrow(
    'native failed',
  );
  expect(schedule).toHaveBeenLastCalledWith(
    expect.objectContaining({ trigger: expect.objectContaining({ hour: 9 }) }),
  );
  existing.mockResolvedValueOnce([reminder('old')]);
  schedule
    .mockRejectedValueOnce(new Error('new failed'))
    .mockRejectedValueOnce(new Error('restore failed'));
  await expect(
    expoNotificationService.scheduleDailyReminder(localTime('20:00')),
  ).rejects.toBeInstanceOf(ReminderRecoveryFailed);
});

test('partial cancellation failure restores the old time when no reminder survives', async () => {
  existing.mockResolvedValueOnce([reminder('old-1'), reminder('old-2')]);
  cancel.mockRejectedValueOnce(new Error('native cancellation failed'));
  existing.mockResolvedValueOnce([]);
  await expect(expoNotificationService.scheduleDailyReminder(localTime('20:00'))).rejects.toThrow(
    'native cancellation failed',
  );
  expect(schedule).toHaveBeenCalledWith(
    expect.objectContaining({ trigger: expect.objectContaining({ hour: 9 }) }),
  );
});

test('permission lookup failure returns unavailable without requesting permission', async () => {
  permissions.mockRejectedValueOnce(new Error('native lookup failed'));
  expect(await expoNotificationService.getPermissionStatus()).toBe('unavailable');
  permissions.mockRejectedValueOnce(new Error('native lookup failed'));
  await expect(
    expoNotificationService.scheduleDailyReminder(localTime('09:00')),
  ).rejects.toBeInstanceOf(NotificationPermissionDenied);
  expect(request).not.toHaveBeenCalled();
  expect(schedule).not.toHaveBeenCalled();
});

test('cancellation is idempotent, limited to the study reminder, and opens system settings', async () => {
  await expoNotificationService.cancelDailyReminder();
  expect(cancel).not.toHaveBeenCalled();
  existing.mockResolvedValueOnce([reminder('ours'), reminder('unrelated', '12:00', false)]);
  await expoNotificationService.cancelDailyReminder();
  expect(cancel).toHaveBeenCalledTimes(1);
  const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
  await expoNotificationService.openSystemSettings();
  expect(open).toHaveBeenCalled();
  open.mockRestore();
});

test('only a tap on the study reminder is delivered once, including a cold-start tap', () => {
  const callback = jest.fn();
  const unsubscribe = expoNotificationService.subscribeToReminderTaps(callback);
  const response = {
    actionIdentifier: 'default',
    notification: { date: 1234, request: reminder('tap-1') },
  } as never;
  const nativeListener = tapListener.mock.calls[0]![0];
  nativeListener({
    actionIdentifier: 'default',
    notification: { date: 1234, request: reminder('other', '09:00', false) },
  } as never);
  expect(callback).not.toHaveBeenCalled();
  nativeListener(response);
  expect(callback).toHaveBeenCalledTimes(1);
  lastResponse.mockReturnValue(response);
  expect(expoNotificationService.consumeLastReminderTap()).toBe(false);
  lastResponse.mockReturnValue({
    actionIdentifier: 'default',
    notification: { date: 1235, request: reminder('tap-2') },
  } as never);
  expect(expoNotificationService.consumeLastReminderTap()).toBe(true);
  expect(clearLastNotificationResponse).toHaveBeenCalledTimes(2);
  unsubscribe();
});

test('the foreground handler shows the reminder without a badge', async () => {
  const behavior = await foregroundHandler!.handleNotification({} as never);
  expect(behavior).toMatchObject({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldSetBadge: false,
  });
});
