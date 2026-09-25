import { Link, router, useFocusEffect } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useCallback, useState, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { config } from '@/core/infrastructure/platform';
import { localTime, type LocalTime } from '@/core/domain/values';
import type { NotificationPermissionState } from '@/core/ports/notification';
import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useThemeMode } from '@/shared/theme/theme-provider';
import { appearanceChoices } from './appearance-options';
import { useSettingsViewModel } from './use-settings-view-model';

const permissionLabels: Record<NotificationPermissionState, string> = {
  notDetermined: 'Not requested',
  authorized: 'Allowed',
  provisional: 'Provisional',
  denied: 'Disabled in device settings',
  unavailable: 'Unavailable',
};

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-md">
      <Text variant="headingSmall" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function SettingsRow({
  label,
  detail,
  onPress,
  disabled = false,
}: {
  label: string;
  detail: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Card
      variant={onPress ? 'interactive' : 'default'}
      disabled={disabled}
      accessibilityLabel={onPress ? `${label}, ${detail}. Choose setting` : undefined}
      onPress={onPress}
      className="gap-xs"
    >
      <Text variant="labelLarge">{label}</Text>
      <Text variant="bodySmall" tone="secondary">
        {detail}
      </Text>
    </Card>
  );
}

function SettingsSwitch({
  label,
  description,
  value,
  busy,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  busy: boolean;
  onChange: () => void;
}) {
  return (
    <Card>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityState={{ checked: value, disabled: busy, busy }}
        disabled={busy}
        onPress={onChange}
        className="flex-row items-center gap-lg"
      >
        <View className="flex-1 gap-xs">
          <Text variant="labelLarge">{label}</Text>
          <Text variant="bodySmall" tone="secondary">
            {description}
          </Text>
        </View>
        <Text variant="labelLarge" tone="accent">
          {value ? 'On' : 'Off'}
        </Text>
      </Pressable>
    </Card>
  );
}

function timeAsDate(time: LocalTime): Date {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour!, minute!, 0, 0);
  return date;
}

function formatTime(date: Date): LocalTime {
  return localTime(
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  );
}

export function SettingsScreen() {
  const vm = useSettingsViewModel();
  const refreshReminder = vm.refreshReminder;
  useFocusEffect(
    useCallback(() => {
      void refreshReminder();
    }, [refreshReminder]),
  );
  const mode = useThemeMode();
  const [draftTime, setDraftTime] = useState<Date | null>(null);
  const settings = vm.settings;
  const permissionLabel = vm.reminderPermission
    ? permissionLabels[vm.reminderPermission]
    : 'Checking';
  const appearance =
    appearanceChoices.find((choice) => choice.value === settings?.theme)?.label ?? 'System';

  function pickTime() {
    if (!settings?.dailyReminderTime || vm.busy.time || vm.busy.reminder) return;
    const value = timeAsDate(settings.dailyReminderTime);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'time',
        is24Hour: true,
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) void vm.setReminderTime(formatTime(selected));
        },
      });
    } else setDraftTime(value);
  }

  return (
    <Screen scroll edges={tabScreenEdges}>
      <View className="gap-2xl">
        <ScreenHeader
          title="Settings"
          description="Make the app comfortable for your study routine."
        />
        {vm.loading && !settings ? <LoadingState label="Loading settings" /> : null}
        {vm.loadError && !settings ? (
          <View className="gap-sm">
            <Text tone="error">Could not load settings.</Text>
            <Button label="Try again" onPress={vm.reload} />
          </View>
        ) : null}
        {settings ? (
          <>
            <SettingsSection title="Appearance">
              <SettingsRow
                label="Theme"
                detail={`Current: ${appearance}`}
                onPress={() => router.push('/settings/appearance')}
              />
            </SettingsSection>

            <SettingsSection title="Study">
              <Text
                variant="bodySmall"
                tone="secondary"
                accessibilityLiveRegion="polite"
                accessibilityLabel={`Notification permission, ${permissionLabel}`}
              >
                Notification permission: {permissionLabel}
              </Text>
              <SettingsSwitch
                label="Daily reminder"
                description="A local reminder to review your cards each day."
                value={settings.dailyReminderEnabled}
                busy={!!vm.busy.reminder || !!vm.busy.time}
                onChange={() => void vm.setReminder(!settings.dailyReminderEnabled)}
              />
              {settings.dailyReminderEnabled && settings.dailyReminderTime ? (
                <>
                  <SettingsRow
                    label="Reminder time"
                    detail={`${settings.dailyReminderTime} (local time)`}
                    disabled={!!vm.busy.time || !!vm.busy.reminder}
                    onPress={pickTime}
                  />
                  {draftTime && Platform.OS !== 'android' ? (
                    <Card className="gap-sm">
                      <DateTimePicker
                        value={draftTime}
                        mode="time"
                        display="spinner"
                        is24Hour
                        themeVariant={mode === 'light' ? 'light' : 'dark'}
                        onChange={(_event, value) => {
                          if (value) setDraftTime(value);
                        }}
                      />
                      <View className="flex-row flex-wrap gap-sm">
                        <Button
                          label="Cancel"
                          variant="secondary"
                          onPress={() => setDraftTime(null)}
                        />
                        <Button
                          label="Save time"
                          loading={!!vm.busy.time}
                          onPress={() => {
                            void vm.setReminderTime(formatTime(draftTime));
                            setDraftTime(null);
                          }}
                        />
                      </View>
                    </Card>
                  ) : null}
                </>
              ) : null}
              {vm.errors.reminder || vm.errors.time ? (
                <Text tone="error" accessibilityLiveRegion="polite">
                  {vm.errors.reminder ?? vm.errors.time}
                </Text>
              ) : null}
              {vm.reminderPermission === 'denied' ? (
                <Button
                  label="Open notification settings"
                  variant="secondary"
                  onPress={() => void vm.openNotificationSettings()}
                />
              ) : null}
            </SettingsSection>

            <SettingsSection title="Audio">
              <SettingsRow
                label="Pronunciation"
                detail="Speech language and English accent"
                onPress={() => router.push('/settings/speech')}
              />
            </SettingsSection>

            <SettingsSection title="Interaction">
              <SettingsSwitch
                label="Haptic feedback"
                description="Subtle feedback for study actions."
                value={settings.hapticsEnabled}
                busy={!!vm.busy.haptics}
                onChange={() => void vm.setHaptics(!settings.hapticsEnabled)}
              />
              {vm.errors.haptics ? (
                <Text tone="error" accessibilityLiveRegion="polite">
                  {vm.errors.haptics}
                </Text>
              ) : null}
            </SettingsSection>

            <SettingsSection title="About">
              <SettingsRow label="App" detail={config.appName} />
              <SettingsRow label="Version" detail={config.appVersion ?? 'Unavailable'} />
              {config.buildNumber ? (
                <SettingsRow label="Build" detail={config.buildNumber} />
              ) : null}
              <SettingsRow
                label="Your data"
                detail="Study data is currently stored locally for this session."
              />
              <SettingsRow label="Privacy Policy" detail="Coming soon" />
              <SettingsRow label="Terms of Use" detail="Coming soon" />
            </SettingsSection>
          </>
        ) : null}
        {__DEV__ ? (
          <Link
            href="/design-system"
            className="min-h-iconButton self-start px-md py-md text-labelLarge text-primary"
            accessibilityRole="link"
          >
            View design system
          </Link>
        ) : null}
      </View>
    </Screen>
  );
}
