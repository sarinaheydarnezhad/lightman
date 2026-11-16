import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Modal, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { storageScopes } from '@/core/composition/repositories';
import { syncEngine } from '@/core/composition/sync';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Screen } from '@/shared/ui/screen';
import { FeedbackNotice } from '@/shared/ui/feedback-notice';
import { Text } from '@/shared/ui/text';
import { Button } from '@/shared/ui/button';
import { LoadingState } from '@/shared/ui/loading-state';
import { backupFailureMessage } from './backup-failure';
import { CloudError } from '@/core/sync/cloud-client';

export function LogoutScreen() {
  const { t } = useLocalization();
  const scope = useSyncExternalStore(storageScopes.subscribe, storageScopes.snapshot);
  const [busy, setBusy] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const cancel = () => {
    if (!submitting.current) router.replace('/(tabs)/settings');
  };
  const logout = async (backup: boolean) => {
    if (submitting.current || !syncEngine || scope.phase !== 'ready' || scope.mode !== 'account')
      return;
    submitting.current = true;
    setBusy(true);
    setBackingUp(backup);
    setError('');
    try {
      await syncEngine.signOut(backup);
      if (mounted.current) router.replace('/(tabs)/settings');
    } catch (failure) {
      if (mounted.current)
        setError(
          failure instanceof CloudError
            ? t(backupFailureMessage(failure))
            : t('logout.backupFailed'),
        );
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  if (scope.phase !== 'ready' || scope.mode !== 'account')
    return (
      <Screen>
        <Text>{t('guest.mode')}</Text>
        <Button label={t('sync.signIn')} onPress={() => router.replace('/auth')} />
      </Screen>
    );
  return (
    <View className="flex-1">
      <Stack.Screen options={{ gestureEnabled: !busy, headerBackVisible: !busy }} />
      <Modal visible transparent animationType="fade" onRequestClose={cancel}>
        <Screen scroll testID="logout-confirmation">
          <View className="gap-xl" accessibilityViewIsModal importantForAccessibility="yes">
            <Text variant="headingSmall" accessibilityRole="header">
              {t('logout.title')}
            </Text>
            <View className="gap-sm">
              <Text variant="labelLarge" accessibilityRole="header">
                {t('logout.consequencesHeading')}
              </Text>
              <Text>{t('logout.confirm')}</Text>
            </View>
            <View className="gap-sm">
              <Text variant="labelLarge" accessibilityRole="header">
                {t('logout.backupHeading')}
              </Text>
              <Text variant="bodySmall" tone="secondary">
                {t('logout.coverage')}
              </Text>
            </View>
            <View className="gap-sm">
              <Text variant="labelLarge" accessibilityRole="header">
                {t('logout.retentionHeading')}
              </Text>
              <Text variant="bodySmall" tone="secondary">
                {t('logout.retention')}
              </Text>
            </View>
            {!syncEngine?.available ? (
              <Text tone="secondary">{t('logout.unavailable')}</Text>
            ) : null}
            {error ? (
              <FeedbackNotice
                title={t('logout.recoveryHeading')}
                message={
                  error === t('logout.backupFailed')
                    ? error
                    : `${t('logout.backupFailed')}\n\n${error}`
                }
              />
            ) : null}
            {busy ? (
              <LoadingState label={t(backingUp ? 'logout.syncing' : 'logout.signingOut')} />
            ) : null}
            <View className="gap-md">
              <Button
                label={t('logout.withBackup')}
                disabled={busy || !syncEngine?.available}
                onPress={() => void logout(true)}
              />
              <Button
                label={t('logout.withoutBackup')}
                variant="destructive"
                disabled={busy}
                onPress={() => void logout(false)}
              />
              <Button
                label={t('common.cancel')}
                variant="tertiary"
                disabled={busy}
                onPress={cancel}
              />
            </View>
          </View>
        </Screen>
      </Modal>
    </View>
  );
}
