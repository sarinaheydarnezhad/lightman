import { useCallback, useEffect, useRef, useState } from 'react';
import { router, Stack } from 'expo-router';
import { BackHandler, View } from 'react-native';
import { guestTransfer } from '@/core/composition/guest-transfer';
import { syncEngine } from '@/core/composition/sync';
import type { TransferPreview, TransferProgress } from '@/core/sync/guest-transfer';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import { Button } from '@/shared/ui/button';
import { LoadingState } from '@/shared/ui/loading-state';

export function GuestDataScreen() {
  const { t } = useLocalization();
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const submitting = useRef(false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => busy);
    return () => subscription.remove();
  }, [busy]);

  const load = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setConfirming(false);
    try {
      if (!guestTransfer) throw new Error(t('migration.unavailable'));
      const result = await guestTransfer.preview();
      if (mounted.current) setPreview(result);
    } catch (failure) {
      if (mounted.current)
        setError(failure instanceof Error ? failure.message : t('migration.failure'));
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [t]);

  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(() => {
      if (mounted.current) void load();
    });
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const transfer = async (backup = false) => {
    if (submitting.current || !preview || !guestTransfer) return;
    submitting.current = true;
    setBusy(true);
    setBackingUp(backup);
    setError('');
    try {
      if (backup) {
        if (!syncEngine?.available) throw new Error(t('backup.unavailable'));
        await syncEngine.createBackup();
        if (mounted.current) setBackingUp(false);
      }
      if (!mounted.current) return;
      await guestTransfer.transfer(preview, (value) => {
        if (mounted.current) setProgress(value);
      });
      if (mounted.current) {
        setSuccess(true);
        setConfirming(false);
      }
    } catch (failure) {
      if (mounted.current)
        setError(failure instanceof Error ? failure.message : t('migration.failure'));
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <Screen scroll testID="guest-data-screen">
      <Stack.Screen options={{ gestureEnabled: !busy, headerBackVisible: !busy }} />
      <View className="gap-lg">
        <ScreenHeader title={t('migration.title')} description={t('migration.preserve')} />
        {busy ? (
          <LoadingState
            label={
              backingUp
                ? t('backup.progress')
                : progress
                  ? t('migration.progress', { ...progress })
                  : t('migration.checking')
            }
          />
        ) : null}
        {error ? (
          <Card>
            <Text tone="error" accessibilityRole="alert">
              {error}
            </Text>
            <Text tone="secondary">{t('migration.failure')}</Text>
          </Card>
        ) : null}
        {success ? (
          <Card>
            <Text accessibilityRole="alert">{t('migration.success')}</Text>
          </Card>
        ) : preview ? (
          <>
            <Text>
              {t(
                preview.accountVerified ? `migration.${preview.scenario}` : 'migration.incomplete',
              )}
            </Text>
            {preview.journal === 'complete' ? <Text>{t('migration.already')}</Text> : null}
            {preview.journal === 'pending' ? <Text>{t('migration.pending')}</Text> : null}
            <Card className="gap-md">
              <Text variant="headingSmall">{t('migration.guestDecks')}</Text>
              {preview.guest.length ? (
                preview.guest.map((deck) => (
                  <Text key={deck.id}>
                    {t('migration.deck', { name: deck.name, cards: deck.cards })}
                  </Text>
                ))
              ) : (
                <Text>{t('migration.noDecks')}</Text>
              )}
              <Text>{t('migration.reviews', { count: preview.reviewEvents })}</Text>
            </Card>
            <Card className="gap-md">
              <Text variant="headingSmall">{t('migration.accountDecks')}</Text>
              {preview.account.length ? (
                preview.account.map((deck) => (
                  <Text key={deck.id}>
                    {t('migration.deck', { name: deck.name, cards: deck.cards })}
                  </Text>
                ))
              ) : (
                <Text>{t('migration.noDecks')}</Text>
              )}
            </Card>
            {preview.sameNames.length ? (
              <Card>
                <Text>{t('migration.sameNames', { names: preview.sameNames.join(', ') })}</Text>
              </Card>
            ) : null}
            <Text tone="secondary">{t('migration.supported')}</Text>
            <Text tone="secondary">{t('migration.backupSafety')}</Text>
            {preview.blockers.map((blocker) => (
              <Text tone="error" key={blocker}>
                {blocker}
              </Text>
            ))}
            {preview.journal !== 'complete' &&
            preview.guest.length &&
            (!preview.blockers.length || preview.journal === 'pending') ? (
              confirming ? (
                <Card className="gap-md">
                  <Text>{t('migration.confirm')}</Text>
                  {preview.account.length ? (
                    <Button
                      label={t('migration.backupAndCopy')}
                      disabled={busy || !syncEngine?.available}
                      onPress={() => void transfer(true)}
                    />
                  ) : null}
                  <Button
                    label={t('migration.confirmAdd')}
                    loading={busy}
                    onPress={() => void transfer()}
                  />
                  <Button
                    label={t('migration.cancel')}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => setConfirming(false)}
                  />
                </Card>
              ) : (
                <Button
                  label={t(preview.journal === 'pending' ? 'migration.resume' : 'migration.add')}
                  disabled={busy}
                  onPress={() => setConfirming(true)}
                />
              )
            ) : null}
          </>
        ) : null}
        {error && !busy ? (
          <Button label={t('migration.retry')} variant="secondary" onPress={() => void load()} />
        ) : null}
        <Button
          label={t(
            success || !preview?.guest.length || preview.journal === 'complete'
              ? 'migration.continue'
              : preview.journal === 'pending' || progress
                ? 'migration.later'
                : 'migration.separate',
          )}
          variant="secondary"
          disabled={busy}
          onPress={() => router.replace('/')}
        />
      </View>
    </Screen>
  );
}
