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
  type NotificationPermissionsStatus,
  type NotificationRequest,
  type NotificationResponse,
} from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { localTime, type LocalTime } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import {
  NotificationPermissionDenied,
  ReminderRecoveryFailed,
  type NotificationPermissionState,
  type NotificationService,
} from '@/core/ports/notification';

const reminderKey = 'lightman.daily-study-reminder';
const channelId = 'study-reminder';
let lastHandledResponse: string | null = null;

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    // Expo suppresses the Android heads-up banner when this is false; the channel itself is silent.
    shouldPlaySound: Platform.OS === 'android',
    shouldSetBadge: false,
  }),
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

async function createReminder(time: LocalTime): Promise<void> {
  const [hour, minute] = time.split(':').map(Number);
  await scheduleNotificationAsync({
    content: {
      title: 'Time to study',
      body: 'You have cards waiting for review.',
      data: { reminderKey },
      sound: false,
      ...(Platform.OS === 'ios' ? { interruptionLevel: 'passive' as const } : {}),
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DAILY,
      hour: hour!,
      minute: minute!,
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
  async scheduleDailyReminder(time) {
    localTime(time);
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
    if (previous.length === 1 && scheduledTime(previous[0]!) === time) return;
    const oldTime = previous.map(scheduledTime).find((value) => value !== null) ?? null;
    try {
      for (const request of previous) await cancelScheduledNotificationAsync(request.identifier);
    } catch (error) {
      // A native cancellation can fail after removing one of several stale reminders.
      // Restore the previous time only when no study reminder survived.
      try {
        if (oldTime && !(await reminderRequests()).length) await createReminder(oldTime);
      } catch (restoreError) {
        throw new ReminderRecoveryFailed(restoreError);
      }
      throw error;
    }
    try {
      await createReminder(time);
    } catch (error) {
      if (oldTime) {
        try {
          await createReminder(oldTime);
        } catch (restoreError) {
          throw new ReminderRecoveryFailed(restoreError);
        }
      }
      throw error;
    }
  },
  async cancelDailyReminder() {
    for (const request of await reminderRequests())
      await cancelScheduledNotificationAsync(request.identifier);
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
