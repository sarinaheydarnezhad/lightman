import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Modal, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { storageScopes } from '@/core/composition/repositories';
import { syncEngine } from '@/core/composition/sync';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Screen } from '@/shared/ui/screen';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import { Button } from '@/shared/ui/button';
import { LoadingState } from '@/shared/ui/loading-state';

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
        setError(failure instanceof Error ? failure.message : t('logout.backupFailed'));
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
          <Card className="gap-md">
            <Text variant="headingSmall" accessibilityRole="header">
              {t('logout.title')}
            </Text>
            <Text>{t('logout.confirm')}</Text>
            <Text tone="secondary">{t('logout.coverage')}</Text>
            <Text tone="secondary">{t('logout.retention')}</Text>
            {!syncEngine?.available ? <Text tone="warning">{t('logout.unavailable')}</Text> : null}
            {error ? (
              <Text tone="error" accessibilityRole="alert">
                {t('logout.backupFailed')} {error}
              </Text>
            ) : null}
            {busy ? (
              <LoadingState label={t(backingUp ? 'logout.syncing' : 'logout.signingOut')} />
            ) : null}
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
              variant="secondary"
              disabled={busy}
              onPress={cancel}
            />
          </Card>
        </Screen>
      </Modal>
    </View>
  );
}
