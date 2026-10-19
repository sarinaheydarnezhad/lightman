import {
  AndroidImportance,
  DEFAULT_ACTION_IDENTIFIER,
  IosAuthorizationStatus,
  SchedulableTriggerInputTypes,
  addNotificationResponseReceivedListener,
  cancelScheduledNotificationAsync,
  clearLastNotificationResponse,
  getAllScheduledNotificationsAsync,
  getLastNotificationResponse,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from './expo-local-notifications';
import type {
  NotificationPermissionsStatus,
  NotificationRequest,
  NotificationResponse,
} from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { localTime, type LocalTime } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import { formatNumber, resolveUiLanguage, translate } from '@/shared/localization/localization';
import {
  NotificationPermissionDenied,
  ReminderRecoveryFailed,
  reminderPlanningDays,
  type NotificationPermissionState,
  type NotificationService,
  type StudyReminder,
} from '@/core/ports/notification';

const reminderKey = 'lerona.daily-study-reminder';
const channelId = 'study-reminder';
let lastHandledResponse: string | null = null;
let reminderWork: Promise<void> = Promise.resolve();

function serializeReminder(action: () => Promise<void>): Promise<void> {
  const result = reminderWork.then(action, action);
  reminderWork = result.catch(() => {});
  return result;
}

setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request?.content?.data;
    const show =
      data?.reminderKey !== reminderKey ||
      (Number.isSafeInteger(data.dueCount) && Number(data.dueCount) > 0);
    return {
      shouldShowBanner: show,
      shouldShowList: show,
      // Expo suppresses the Android heads-up banner when this is false; the channel itself is silent.
      shouldPlaySound: show && Platform.OS === 'android',
      shouldSetBadge: false,
    };
  },
});

function permissionState(status: NotificationPermissionsStatus): NotificationPermissionState {
  if (Platform.OS === 'ios' && status.ios) {
    switch (status.ios.status) {
      case IosAuthorizationStatus.NOT_DETERMINED:
        return 'notDetermined';
      case IosAuthorizationStatus.PROVISIONAL:
        return 'provisional';
      case IosAuthorizationStatus.AUTHORIZED:
      case IosAuthorizationStatus.EPHEMERAL:
        return 'authorized';
      case IosAuthorizationStatus.DENIED:
        return 'denied';
      default:
        return 'unavailable';
    }
  }
  if (status.granted) return 'authorized';
  if (status.status === 'undetermined') return 'notDetermined';
  if (status.status === 'denied') return 'denied';
  return 'unavailable';
}

async function reminderRequests(): Promise<NotificationRequest[]> {
  if (Platform.OS === 'web') return [];
  const scheduled = await getAllScheduledNotificationsAsync();
  return scheduled.filter((request) => request.content.data?.reminderKey === reminderKey);
}

function scheduledTime(request: NotificationRequest): LocalTime | null {
  const savedTime = request.content.data?.localTime;
  if (typeof savedTime === 'string') {
    try {
      return localTime(savedTime);
    } catch {
      return null;
    }
  }
  const trigger = request.trigger;
  if (!trigger || !('hour' in trigger) || !('minute' in trigger)) return null;
  if (!Number.isInteger(trigger.hour) || !Number.isInteger(trigger.minute)) return null;
  try {
    return localTime(
      `${String(trigger.hour).padStart(2, '0')}:${String(trigger.minute).padStart(2, '0')}`,
    );
  } catch {
    return null;
  }
}

async function createReminder(
  time: LocalTime,
  language: string,
  reminder: StudyReminder,
): Promise<string> {
  return scheduleNotificationAsync({
    content: {
      title: translate(language, 'notification.title'),
      body: translate(
        language,
        reminder.dueCount === 1 ? 'notification.singleBody' : 'notification.body',
        { count: formatNumber(reminder.dueCount, resolveUiLanguage(language)) },
      ),
      data: { reminderKey, uiLanguage: resolveUiLanguage(language), localTime: time, ...reminder },
      sound: false,
      ...(Platform.OS === 'ios' ? { interruptionLevel: 'passive' as const } : {}),
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      date: new Date(reminder.scheduledForUtc),
      ...(Platform.OS === 'android' ? { channelId } : {}),
    },
  });
}

function isReminderTap(response: NotificationResponse | null): response is NotificationResponse {
  return (
    response?.actionIdentifier === DEFAULT_ACTION_IDENTIFIER &&
    response.notification.request.content.data?.reminderKey === reminderKey
  );
}

function handleTap(response: NotificationResponse | null, listener: () => void): boolean {
  if (!isReminderTap(response)) return false;
  const key = `${response.notification.request.identifier}:${response.notification.date}`;
  if (lastHandledResponse === key) return false;
  lastHandledResponse = key;
  try {
    clearLastNotificationResponse();
  } catch {
    /* A tap is still usable if clearing fails. */
  }
  listener();
  return true;
}

export const expoNotificationService: NotificationService = {
  async getPermissionStatus() {
    if (Platform.OS === 'web') return 'unavailable';
    try {
      return permissionState(await getPermissionsAsync());
    } catch {
      return 'unavailable';
    }
  },
  async requestPermission() {
    const current = await this.getPermissionStatus();
    if (current !== 'notDetermined') return current;
    try {
      if (Platform.OS === 'android') {
        await setNotificationChannelAsync(channelId, {
          name: 'Study reminders',
          importance: AndroidImportance.DEFAULT,
          sound: null,
        });
      }
      return permissionState(await requestPermissionsAsync());
    } catch {
      return 'unavailable';
    }
  },
  async getScheduledReminder() {
    for (const request of await reminderRequests()) {
      const time = scheduledTime(request);
      if (time) return { time };
    }
    return null;
  },
  scheduleDailyReminder(time, language = 'en', reminders = []) {
    return serializeReminder(async () => {
      localTime(time);
      const plan = reminders.filter((reminder) => {
        if (
          !Number.isSafeInteger(reminder.dueCount) ||
          reminder.dueCount < 0 ||
          !Number.isFinite(Date.parse(reminder.scheduledForUtc))
        )
          throw new AppError('validation', 'Invalid study reminder.');
        return reminder.dueCount > 0 && Date.parse(reminder.scheduledForUtc) > Date.now();
      });
      if (
        plan.length > reminderPlanningDays ||
        new Set(plan.map((item) => item.scheduledForUtc)).size !== plan.length
      )
        throw new AppError('validation', 'Invalid study reminder plan.');
      if (Platform.OS === 'web') throw new AppError('unavailable', 'Local reminders unavailable.');
      if (Platform.OS === 'android') {
        await setNotificationChannelAsync(channelId, {
          name: 'Study reminders',
          importance: AndroidImportance.DEFAULT,
          sound: null,
        });
      }
      const permission = await this.getPermissionStatus();
      if (permission !== 'authorized' && permission !== 'provisional')
        throw new NotificationPermissionDenied();

      const previous = await reminderRequests();
      if (
        previous.length === plan.length &&
        plan.every((item) =>
          previous.some(
            (request) =>
              scheduledTime(request) === time &&
              request.content.data?.scheduledForUtc === item.scheduledForUtc &&
              request.content.data?.dueCount === item.dueCount &&
              request.content.data?.uiLanguage === resolveUiLanguage(language),
          ),
        )
      )
        return;
      const created: string[] = [];
      try {
        for (const request of previous) await cancelScheduledNotificationAsync(request.identifier);
        for (const item of plan) created.push(await createReminder(time, language, item));
      } catch (error) {
        try {
          for (const identifier of created) await cancelScheduledNotificationAsync(identifier);
          const remaining = await reminderRequests();
          for (const request of previous) {
            if (remaining.some((item) => item.identifier === request.identifier)) continue;
            const oldTime = scheduledTime(request);
            const data = request.content.data;
            if (
              oldTime &&
              typeof data?.scheduledForUtc === 'string' &&
              Date.parse(data.scheduledForUtc) > Date.now() &&
              Number.isSafeInteger(data.dueCount) &&
              Number(data.dueCount) > 0
            )
              await createReminder(
                oldTime,
                typeof data.uiLanguage === 'string' ? data.uiLanguage : 'en',
                { scheduledForUtc: data.scheduledForUtc, dueCount: Number(data.dueCount) },
              );
          }
        } catch (restoreError) {
          throw new ReminderRecoveryFailed(restoreError);
        }
        throw error;
      }
    });
  },
  cancelDailyReminder() {
    return serializeReminder(async () => {
      for (const request of await reminderRequests())
        await cancelScheduledNotificationAsync(request.identifier);
    });
  },
  openSystemSettings: () => Linking.openSettings(),
  subscribeToReminderTaps(listener) {
    if (Platform.OS === 'web') return () => {};
    const subscription = addNotificationResponseReceivedListener((response) => {
      handleTap(response, listener);
    });
    return () => subscription.remove();
  },
  consumeLastReminderTap() {
    if (Platform.OS === 'web') return false;
    let tapped = false;
    handleTap(getLastNotificationResponse(), () => {
      tapped = true;
    });
    return tapped;
  },
};
