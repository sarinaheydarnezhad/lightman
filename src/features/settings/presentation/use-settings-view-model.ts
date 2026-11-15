import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { application } from '@/core/composition/application';
import { haptics } from '@/core/composition/haptics';
import {
  NotificationPermissionDenied,
  type NotificationPermissionState,
} from '@/core/ports/notification';
import type { MessageKey } from '@/shared/localization/messages';
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
  const [errors, setErrors] = useState<Partial<Record<SettingKey, MessageKey>>>({});
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
    if (!settings) reload();
    return () => {
      active.current = false;
    };
  }, [reload, settings]);

  const refreshReminder = useCallback(async () => {
    try {
      const permission = await application.settings.reconcileReminder();
      if (active.current) setReminderPermission(permission);
    } catch {
      if (active.current)
        setErrors((old) => ({
          ...old,
          reminder: 'settings.reminderCheckError',
        }));
    }
  }, []);

  const execute = useCallback(
    async (key: SettingKey, action: () => Promise<UserSettings>, message: MessageKey) => {
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
              ? 'settings.notificationsDenied'
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
      execute('theme', () => application.settings.setTheme(theme), 'settings.themeSaveError'),
    setLanguage: (language: UserSettings['language']) =>
      execute(
        'language',
        () => application.settings.setLanguage(language),
        'settings.languageSaveError',
      ),
    setHaptics: (enabled: boolean) =>
      execute(
        'haptics',
        () => application.settings.setHaptics(enabled),
        'settings.hapticsSaveError',
      ),
    setReminder: (enabled: boolean) =>
      execute(
        'reminder',
        () => application.settings.setReminderEnabled(enabled),
        'settings.reminderSaveError',
      ),
    setReminderTime: (time: NonNullable<UserSettings['dailyReminderTime']>) =>
      execute('time', () => application.settings.setReminderTime(time), 'settings.timeSaveError'),
    setSpeechLanguage: (language: UserSettings['preferredSpeechLanguage']) =>
      execute(
        'speech',
        () => application.settings.setSpeechLanguage(language),
        'settings.speechSaveError',
      ),
    setSpeechAccent: (accent: UserSettings['preferredSpeechAccent']) =>
      execute(
        'speech',
        () => application.settings.setSpeechAccent(accent),
        'settings.accentSaveError',
      ),
    openNotificationSettings: () =>
      application.settings.openNotificationSettings().catch(() => {
        setErrors((old) => ({
          ...old,
          reminder: 'settings.openNotificationsError',
        }));
      }),
  };
}
