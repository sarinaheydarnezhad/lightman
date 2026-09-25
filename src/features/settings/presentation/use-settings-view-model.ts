import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { application } from '@/core/composition/application';
import { haptics } from '@/core/composition/haptics';
import {
  NotificationPermissionDenied,
  type NotificationPermissionState,
} from '@/core/ports/notification';
import type { UserSettings } from '../domain/user-settings';

type SettingKey = 'theme' | 'language' | 'haptics' | 'reminder' | 'time' | 'speech';

/** Only loading, errors and pending operations are UI state; preferences live in the repository. */
export function useSettingsViewModel() {
  const settings = useSyncExternalStore(
    application.settings.subscribe,
    application.settings.snapshot,
  );
  const [loading, setLoading] = useState(!settings);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<Partial<Record<SettingKey, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<SettingKey, string>>>({});
  const [reminderPermission, setReminderPermission] = useState<NotificationPermissionState | null>(
    null,
  );
  const active = useRef(true);
  const pending = useRef(new Set<SettingKey>());

  const reload = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    void application.settings.get().then(
      (value) => {
        if (active.current) {
          setLoading(false);
          setLoadError(!value);
        }
      },
      () => {
        if (active.current) {
          setLoading(false);
          setLoadError(true);
        }
      },
    );
  }, []);
  useEffect(() => {
    active.current = true;
    reload();
    return () => {
      active.current = false;
    };
  }, [reload]);

  const refreshReminder = useCallback(async () => {
    try {
      const permission = await application.settings.reconcileReminder();
      if (active.current) setReminderPermission(permission);
    } catch {
      if (active.current)
        setErrors((old) => ({
          ...old,
          reminder: 'Could not check your reminder. Please reopen Settings to retry.',
        }));
    }
  }, []);

  const execute = useCallback(
    async (key: SettingKey, action: () => Promise<UserSettings>, message: string) => {
      if (pending.current.has(key)) return;
      pending.current.add(key);
      setBusy((old) => ({ ...old, [key]: true }));
      setErrors((old) => ({ ...old, [key]: undefined }));
      try {
        const updated = await action();
        if (key === 'reminder' || key === 'time')
          setReminderPermission(await application.settings.getReminderPermission());
        if (key !== 'haptics' || updated.hapticsEnabled) void haptics.selection();
        return true;
      } catch (error) {
        if (error instanceof NotificationPermissionDenied)
          setReminderPermission(await application.settings.getReminderPermission());
        setErrors((old) => ({
          ...old,
          [key]:
            error instanceof NotificationPermissionDenied
              ? 'Notifications are turned off for this app. Allow them in device settings, then try again.'
              : message,
        }));
        return false;
      } finally {
        pending.current.delete(key);
        if (active.current) setBusy((old) => ({ ...old, [key]: false }));
      }
    },
    [],
  );

  return {
    settings,
    loading,
    loadError,
    reload,
    busy,
    errors,
    reminderPermission,
    refreshReminder,
    setTheme: (theme: UserSettings['theme']) =>
      execute(
        'theme',
        () => application.settings.setTheme(theme),
        'Could not save appearance. Please try again.',
      ),
    setLanguage: (language: UserSettings['language']) =>
      execute(
        'language',
        () => application.settings.setLanguage(language),
        'Could not save app language. Please try again.',
      ),
    setHaptics: (enabled: boolean) =>
      execute(
        'haptics',
        () => application.settings.setHaptics(enabled),
        'Could not save haptic feedback. Please try again.',
      ),
    setReminder: (enabled: boolean) =>
      execute(
        'reminder',
        () => application.settings.setReminderEnabled(enabled),
        'Could not change the daily reminder. Please try again.',
      ),
    setReminderTime: (time: NonNullable<UserSettings['dailyReminderTime']>) =>
      execute(
        'time',
        () => application.settings.setReminderTime(time),
        'Could not save the reminder time. Please try again.',
      ),
    setSpeechLanguage: (language: UserSettings['preferredSpeechLanguage']) =>
      execute(
        'speech',
        () => application.settings.setSpeechLanguage(language),
        'Could not save speech language. Please try again.',
      ),
    setSpeechAccent: (accent: UserSettings['preferredSpeechAccent']) =>
      execute(
        'speech',
        () => application.settings.setSpeechAccent(accent),
        'Could not save English accent. Please try again.',
      ),
    openNotificationSettings: () =>
      application.settings.openNotificationSettings().catch(() => {
        setErrors((old) => ({
          ...old,
          reminder: 'Could not open device settings. Open this app in your device Settings.',
        }));
      }),
  };
}
