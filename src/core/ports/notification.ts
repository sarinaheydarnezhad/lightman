import type { LocalTime } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';

/** Owns only the app's daily study reminder; other scheduled alerts are untouched. */
export interface NotificationService {
  getPermissionStatus(): Promise<NotificationPermissionState>;
  requestPermission(): Promise<NotificationPermissionState>;
  getScheduledReminder(): Promise<{ readonly time: LocalTime } | null>;
  scheduleDailyReminder(time: LocalTime): Promise<void>;
  cancelDailyReminder(): Promise<void>;
  openSystemSettings(): Promise<void>;
  subscribeToReminderTaps(listener: () => void): () => void;
  consumeLastReminderTap(): boolean;
}

export type NotificationPermissionState =
  'notDetermined' | 'authorized' | 'provisional' | 'denied' | 'unavailable';

export class NotificationPermissionDenied extends AppError {
  constructor() {
    super('unavailable', 'Notification permission denied.');
    this.name = 'NotificationPermissionDenied';
  }
}

/** The old native reminder could not be restored after a failed replacement. */
export class ReminderRecoveryFailed extends AppError {
  constructor(cause?: unknown) {
    super('unavailable', 'Unable to restore the previous reminder.', cause);
  }
}
