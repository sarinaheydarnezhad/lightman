import { Link, router, useFocusEffect, type Href } from 'expo-router';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useCallback, useState, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { config } from '@/core/infrastructure/platform';
import { localTime, type LocalTime } from '@/core/domain/values';
import type { NotificationPermissionState } from '@/core/ports/notification';
import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useThemeColors, useThemeMode } from '@/shared/theme/theme-provider';
import { icons, interaction } from '@/shared/theme/tokens';
import { useLocalization } from '@/shared/localization/localization-provider';
import type { MessageKey } from '@/shared/localization/messages';
import { appearanceChoices } from './appearance-options';
import { useSettingsViewModel } from './use-settings-view-model';

const permissionLabels: Record<NotificationPermissionState, MessageKey> = {
  notDetermined: 'settings.permission.notDetermined',
  authorized: 'settings.permission.authorized',
  provisional: 'settings.permission.provisional',
  denied: 'settings.permission.denied',
  unavailable: 'settings.permission.unavailable',
};

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-sm">
      <Text variant="headingSmall" accessibilityRole="header">
        {title}
      </Text>
      <View>{children}</View>
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
  const { t, direction } = useLocalization();
  const colors = useThemeColors();
  const Chevron = direction === 'rtl' ? ChevronLeft : ChevronRight;
  const content = (
    <View className="min-w-0 flex-1 gap-xs">
      <Text variant="labelLarge">{label}</Text>
      <Text variant="bodySmall" tone="secondary">
        {detail}
      </Text>
    </View>
  );
  if (!onPress) {
    return (
      <View className="min-h-listItem justify-center border-b border-border py-lg">{content}</View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('settings.choose', { label, detail })}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-listItem w-full items-center justify-between gap-md border-b border-border py-lg ${
        direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'
      }`}
      style={(state) =>
        disabled
          ? { opacity: interaction.disabledOpacity }
          : state.pressed
            ? { backgroundColor: colors.surfaceElevated }
            : undefined
      }
    >
      {content}
      <Chevron color={colors.tertiaryText} size={icons.medium} />
    </Pressable>
  );
}

function SettingsSwitch({
  label,
  description,
  value,
  busy,
  disabled = false,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  busy: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  const { t, direction } = useLocalization();
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, busy }}
      disabled={busy || disabled}
      onPress={onChange}
      className={`min-h-listItem w-full items-center justify-between gap-md border-b border-border py-lg ${
        direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'
      }`}
      style={(state) =>
        busy || disabled
          ? { opacity: interaction.disabledOpacity }
          : state.pressed
            ? { backgroundColor: colors.surfaceElevated }
            : undefined
      }
    >
      <View className="min-w-0 flex-1 gap-xs">
        <Text variant="labelLarge">{label}</Text>
        <Text variant="bodySmall" tone="secondary">
          {description}
        </Text>
      </View>
      <View
        className={
          value
            ? 'rounded-full bg-primarySoft px-md py-xs'
            : 'rounded-full bg-surfaceElevated px-md py-xs'
        }
      >
        <Text variant="labelMedium" tone={value ? 'accent' : 'secondary'}>
          {t(value ? 'common.on' : 'common.off')}
        </Text>
      </View>
    </Pressable>
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
  const { t, language } = useLocalization();
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
    ? t(permissionLabels[vm.reminderPermission])
    : t('settings.permission.checking');
  const appearance = t(
    `settings.theme.${appearanceChoices.find((choice) => choice.value === settings?.theme)?.value ?? 'system'}`,
  );

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
        <ScreenHeader title={t('nav.settings')} description={t('settings.description')} />
        {vm.loading && !settings ? <LoadingState label={t('settings.loading')} /> : null}
        {vm.loadError && !settings ? (
          <ErrorState
            title={t('settings.loadError')}
            description={t('common.genericError')}
            onRetry={vm.reload}
          />
        ) : null}
        {settings ? (
          <>
            <SettingsSection title={t('settings.appearance')}>
              <SettingsRow
                label={t('settings.theme')}
                detail={t('settings.current', { value: appearance })}
                onPress={() => router.push('/settings/appearance')}
              />
              <SettingsRow
                label={t('settings.appLanguage')}
                detail={t(`language.${language}`)}
                onPress={() => router.push('/settings/language')}
              />
            </SettingsSection>

            <SettingsSection title={t('settings.study')}>
              <Text
                variant="bodySmall"
                tone="secondary"
                accessibilityLiveRegion="polite"
                accessibilityLabel={t('settings.permission', { value: permissionLabel })}
              >
                {t('settings.permission', { value: permissionLabel })}
              </Text>
              <SettingsSwitch
                label={t('settings.dailyReminder')}
                description={t('settings.reminderHint')}
                value={settings.dailyReminderEnabled}
                busy={!!vm.busy.reminder || !!vm.busy.time}
                disabled={vm.reminderPermission === 'unavailable' && !settings.dailyReminderEnabled}
                onChange={() => void vm.setReminder(!settings.dailyReminderEnabled)}
              />
              {settings.dailyReminderEnabled && settings.dailyReminderTime ? (
                <>
                  <SettingsRow
                    label={t('settings.reminderTime')}
                    detail={t('settings.localTime', { time: settings.dailyReminderTime })}
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
                          label={t('common.cancel')}
                          variant="secondary"
                          onPress={() => setDraftTime(null)}
                        />
                        <Button
                          label={t('settings.saveTime')}
                          loading={!!vm.busy.time}
                          onPress={() => {
                            void vm.setReminderTime(formatTime(draftTime)).then((saved) => {
                              if (saved) setDraftTime(null);
                            });
                          }}
                        />
                      </View>
                    </Card>
                  ) : null}
                </>
              ) : null}
              {vm.errors.reminder || vm.errors.time ? (
                <Text tone="error" accessibilityLiveRegion="polite">
                  {language === 'en'
                    ? (vm.errors.reminder ?? vm.errors.time)
                    : t('common.genericError')}
                </Text>
              ) : null}
              {vm.reminderPermission === 'denied' ? (
                <Button
                  label={t('settings.openNotifications')}
                  variant="secondary"
                  onPress={() => void vm.openNotificationSettings()}
                />
              ) : null}
            </SettingsSection>

            <SettingsSection title={t('settings.audio')}>
              <SettingsRow
                label={t('settings.pronunciation')}
                detail={t('settings.pronunciationHint')}
                onPress={() => router.push('/settings/speech')}
              />
            </SettingsSection>

            <View style={{ display: 'none' }}>
              <SettingsSection title={t('settings.interaction')}>
                <SettingsSwitch
                  label={t('settings.haptics')}
                  description={t('settings.hapticsHint')}
                  value={settings.hapticsEnabled}
                  busy={!!vm.busy.haptics}
                  onChange={() => void vm.setHaptics(!settings.hapticsEnabled)}
                />
                {vm.errors.haptics ? (
                  <Text tone="error" accessibilityLiveRegion="polite">
                    {language === 'en' ? vm.errors.haptics : t('common.genericError')}
                  </Text>
                ) : null}
              </SettingsSection>
            </View>

            <SettingsSection title={t('settings.about')}>
              <SettingsRow
                label={t('transfer.title')}
                detail={t('transfer.description')}
                onPress={() => router.push('/settings/transfer' as Href)}
              />
              <SettingsRow
                label={t('sync.title')}
                detail={t('sync.description')}
                onPress={() => router.push('/settings/cloud' as Href)}
              />
              <SettingsRow label={t('settings.app')} detail={config.appName} />
              <SettingsRow
                label={t('settings.version')}
                detail={config.appVersion ?? t('common.unavailable')}
              />
              {config.buildNumber ? (
                <SettingsRow label={t('settings.build')} detail={config.buildNumber} />
              ) : null}
              <SettingsRow label={t('settings.yourData')} detail={t('settings.yourDataHint')} />
            </SettingsSection>
          </>
        ) : null}
        {__DEV__ ? (
          <Link
            href="/design-system"
            className="min-h-iconButton self-start px-md py-md text-labelLarge text-primary"
            accessibilityRole="link"
          >
            {t('settings.viewDesignSystem')}
          </Link>
        ) : null}
      </View>
    </Screen>
  );
}
