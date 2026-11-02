import { Link, router, useFocusEffect, type Href } from 'expo-router';
import { FeedbackModal } from '@/shared/ui/feedback-modal';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { config } from '@/core/infrastructure/platform';
import { localTime, type LocalTime } from '@/core/domain/values';
import type { NotificationPermissionState } from '@/core/ports/notification';
import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/error-state';
import { Input } from '@/shared/ui/input';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { icons, interaction } from '@/shared/theme/tokens';
import { useLocalization } from '@/shared/localization/localization-provider';
import type { MessageKey } from '@/shared/localization/messages';
import { appearanceChoices } from './appearance-options';
import { useSettingsViewModel } from './use-settings-view-model';
import { SettingsAccountCard } from './settings-account-card';

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
      <Card className="py-xs">{children}</Card>
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
      <View className="min-h-listItem w-full flex-row items-center border-b border-border py-lg">
        {content}
      </View>
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
  description?: string;
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
        {description ? (
          <Text variant="bodySmall" tone="secondary">
            {description}
          </Text>
        ) : null}
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

export function SettingsScreen() {
  const vm = useSettingsViewModel();
  const { t, language } = useLocalization();
  const refreshReminder = vm.refreshReminder;
  useFocusEffect(
    useCallback(() => {
      void refreshReminder();
    }, [refreshReminder]),
  );
  const [draftTime, setDraftTime] = useState<string | null>(null);
  const [timeInvalid, setTimeInvalid] = useState(false);
  const settings = vm.settings;
  const permissionLabel = vm.reminderPermission
    ? t(permissionLabels[vm.reminderPermission])
    : t('settings.permission.checking');
  const appearance = t(
    `settings.theme.${appearanceChoices.find((choice) => choice.value === settings?.theme)?.value ?? 'light'}`,
  );

  async function saveTime() {
    if (draftTime === null || vm.busy.time || vm.busy.reminder) return;
    let time: LocalTime;
    try {
      time = localTime(
        draftTime
          .trim()
          .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
          .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660)),
      );
    } catch {
      setTimeInvalid(true);
      return;
    }
    if (await vm.setReminderTime(time)) setDraftTime(null);
  }

  return (
    <Screen scroll keyboardAware edges={tabScreenEdges}>
      <View className="gap-2xl">
        <ScreenHeader title={t('nav.settings')} description={t('settings.description')} />
        <SettingsAccountCard />
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
              <SettingsSwitch
                label={t('settings.dailyReminder')}
                value={settings.dailyReminderEnabled}
                busy={!!vm.busy.reminder || !!vm.busy.time}
                disabled={vm.reminderPermission === 'unavailable' && !settings.dailyReminderEnabled}
                onChange={() => void vm.setReminder(!settings.dailyReminderEnabled)}
              />
              <Text
                variant="bodySmall"
                tone="secondary"
                accessibilityLiveRegion="polite"
                accessibilityLabel={t('settings.permission', { value: permissionLabel })}
              >
                {t('settings.permission', { value: permissionLabel })}
              </Text>
              {settings.dailyReminderEnabled && settings.dailyReminderTime ? (
                <>
                  <SettingsRow
                    label={t('settings.reminderTime')}
                    detail={t('settings.localTime', { time: settings.dailyReminderTime })}
                    disabled={!!vm.busy.time || !!vm.busy.reminder}
                    onPress={() => {
                      setDraftTime(settings.dailyReminderTime);
                      setTimeInvalid(false);
                    }}
                  />
                  {draftTime !== null ? (
                    <Card className="gap-sm">
                      <Input
                        label={t('settings.reminderTime')}
                        value={draftTime}
                        placeholder="HH:mm"
                        helperText={t('settings.timeFormat')}
                        error={timeInvalid ? t('settings.timeInvalid') : undefined}
                        onDismissError={() => setTimeInvalid(false)}
                        disabled={!!vm.busy.time || !!vm.busy.reminder}
                        autoFocus
                        selectTextOnFocus
                        autoCorrect={false}
                        autoCapitalize="none"
                        returnKeyType="done"
                        textAlign="left"
                        style={{ writingDirection: 'ltr' }}
                        onChangeText={(value) => {
                          setDraftTime(value);
                          setTimeInvalid(false);
                        }}
                        onSubmitEditing={() => void saveTime()}
                      />
                      <View className="flex-row flex-wrap gap-sm">
                        <Button
                          label={t('common.cancel')}
                          variant="secondary"
                          disabled={!!vm.busy.time || !!vm.busy.reminder}
                          onPress={() => setDraftTime(null)}
                        />
                        <Button
                          label={t('settings.saveTime')}
                          loading={!!vm.busy.time}
                          disabled={!!vm.busy.reminder}
                          onPress={() => void saveTime()}
                        />
                      </View>
                    </Card>
                  ) : null}
                </>
              ) : null}
              {vm.errors.reminder || vm.errors.time ? (
                <FeedbackModal message={language === 'en'
                    ? (vm.errors.reminder ?? vm.errors.time)
                    : t('common.genericError')} />
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
                  <FeedbackModal message={language === 'en' ? vm.errors.haptics : t('common.genericError')} />
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
