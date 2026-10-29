import { useCallback, useEffect, useRef, useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { BackHandler, Modal, View } from 'react-native';
import { guestTransfer } from '@/core/composition/guest-transfer';
import { storageScopes } from '@/core/composition/repositories';
import { syncEngine } from '@/core/composition/sync';
import { application } from '@/core/composition/application';
import type { TransferPreview, TransferProgress } from '@/core/sync/guest-transfer';
import { LocalizationProvider, useLocalization } from '@/shared/localization/localization-provider';
import { resolveUiLanguage } from '@/shared/localization/localization';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import { Button } from '@/shared/ui/button';
import { LoadingState } from '@/shared/ui/loading-state';
import { FeedbackModal } from '@/shared/ui/feedback-modal';
import { ConfirmationPanel } from '@/shared/ui/confirmation-panel';
import { guestTransferFeedback } from './guest-transfer-feedback';
import { AccountNameGate } from './account-name-gate';

export function GuestDataScreen({
  embedded = false,
  language: entryLanguage,
}: {
  embedded?: boolean;
  language?: 'en' | 'fa';
} = {}) {
  const { language: routeLanguage } = useLocalSearchParams<{ language?: string }>();
  const [language] = useState(
    () =>
      entryLanguage ??
      (routeLanguage === 'en' || routeLanguage === 'fa'
        ? routeLanguage
        : resolveUiLanguage(application.settings.snapshot()?.language)),
  );
  return (
    <LocalizationProvider language={language === 'fa' || language === 'en' ? language : undefined}>
      <AccountNameGate>
        <GuestDataContent embedded={embedded} />
      </AccountNameGate>
    </LocalizationProvider>
  );
}

function GuestDataContent({ embedded }: { embedded: boolean }) {
  const { t, number, language } = useLocalization();
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [error, setError] = useState('');
  const [settingsConflict, setSettingsConflict] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const mounted = useRef(true);
  const submitting = useRef(false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const openAccount = useCallback(() => {
    if (!mounted.current) return;
    storageScopes.completeAccountEntry();
    router.replace('/');
  }, []);

  const load = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setSettingsConflict(null);
    setProgress(null);
    try {
      if (!guestTransfer) throw new Error(t('migration.unavailable'));
      const result = await guestTransfer.preview();
      if (!mounted.current) return;
      setPreview(result);
      if (result.journal === 'complete') {
        await guestTransfer.finish(result);
        openAccount();
      } else if (!(result.hasGuestData ?? result.guest.length > 0) && result.accountVerified) {
        openAccount();
      }
    } catch (failure) {
      const status = await syncEngine?.status().catch(() => null);
      if (mounted.current) {
        setSettingsConflict(
          status?.conflicts.find((conflict) => conflict.entityType === 'settings')?.operationId ??
            null,
        );
        setError(guestTransferFeedback(failure, language, t, 'migration.failure'));
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [t, language, openAccount]);

  const resolveSettings = async (choice: 'server' | 'local') => {
    if (submitting.current || !settingsConflict || !syncEngine) return;
    submitting.current = true;
    setBusy(true);
    try {
      await syncEngine.resolve(settingsConflict, choice);
    } catch (failure) {
      if (mounted.current)
        setError(guestTransferFeedback(failure, language, t, 'migration.failure'));
      return;
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
    if (mounted.current) await load();
  };

  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(() => {
      if (mounted.current) void load();
    });
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const transfer = async () => {
    if (
      submitting.current ||
      !preview ||
      !guestTransfer ||
      !preview.guest.length ||
      !preview.accountVerified ||
      (preview.blockers.length && preview.journal !== 'pending')
    )
      return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      if (preview.journal !== 'complete')
        await guestTransfer.transfer(preview, (value) => {
          if (mounted.current) setProgress(value);
        });
      await guestTransfer.finish(preview);
      openAccount();
    } catch (failure) {
      if (mounted.current)
        setError(guestTransferFeedback(failure, language, t, 'migration.failure'));
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const discard = async () => {
    if (submitting.current || !preview || !guestTransfer || preview.journal === 'pending') return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await guestTransfer.discard(preview);
      openAccount();
    } catch (failure) {
      if (mounted.current)
        setError(guestTransferFeedback(failure, language, t, 'migration.failure'));
    } finally {
      submitting.current = false;
      if (mounted.current) {
        setBusy(false);
        setConfirmDiscard(false);
      }
    }
  };

  const logout = async () => {
    if (submitting.current || !syncEngine) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await syncEngine.signOut();
      if (mounted.current) router.replace('/(tabs)/settings');
    } catch (failure) {
      if (mounted.current)
        setError(guestTransferFeedback(failure, language, t, 'migration.failure'));
    } finally {
      submitting.current = false;
      if (mounted.current) {
        setBusy(false);
        setConfirmLogout(false);
      }
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={() => {}}>
      <Screen scroll testID="guest-data-screen">
        {!embedded ? (
          <Stack.Screen
            options={{
              title: t('migration.title'),
              gestureEnabled: false,
              headerBackVisible: false,
            }}
          />
        ) : null}
        <View className="gap-lg">
          <ScreenHeader title={t('migration.title')} description={t('migration.preserve')} />
          {busy ? (
            <LoadingState
              label={
                progress
                  ? t('migration.progress', {
                      acknowledged: number(progress.acknowledged),
                      total: number(progress.total),
                    })
                  : t('migration.checking')
              }
            />
          ) : null}
          {error ? (
            <FeedbackModal
              message={error}
              onRetry={() => void load()}
              retryLabel={t('migration.retry')}
            >
              {error !== t('migration.failure') ? (
                <Text tone="secondary">{t('migration.failure')}</Text>
              ) : null}
              {settingsConflict ? (
                <View className="gap-sm">
                  <Text>{t('migration.settingsConflict')}</Text>
                  <Button
                    label={t('sync.keepServer')}
                    disabled={busy}
                    onPress={() => void resolveSettings('server')}
                  />
                  <Button
                    label={t('sync.keepLocal')}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => void resolveSettings('local')}
                  />
                </View>
              ) : null}
            </FeedbackModal>
          ) : null}
          {preview ? (
            <>
              <Text>
                {t(
                  preview.accountVerified
                    ? `migration.${preview.scenario}`
                    : 'migration.incomplete',
                )}
              </Text>
              {preview.journal === 'complete' ? <Text>{t('migration.already')}</Text> : null}
              {preview.journal === 'pending' ? <Text>{t('migration.pending')}</Text> : null}
              <Card className="gap-md">
                <Text variant="headingSmall">{t('migration.guestDecks')}</Text>
                {preview.journal !== 'complete' && preview.guest.length ? (
                  preview.guest.map((deck) => (
                    <Text key={deck.id}>
                      {t('migration.deck', { name: deck.name, cards: number(deck.cards) })}
                    </Text>
                  ))
                ) : (
                  <Text>{t('migration.noDecks')}</Text>
                )}
                <Text>{t('migration.reviews', { count: number(preview.reviewEvents) })}</Text>
              </Card>
              <Card className="gap-md">
                <Text variant="headingSmall">{t('migration.accountDecks')}</Text>
                {preview.account.length ? (
                  preview.account.map((deck) => (
                    <Text key={deck.id}>
                      {t('migration.deck', { name: deck.name, cards: number(deck.cards) })}
                    </Text>
                  ))
                ) : (
                  <Text>{t('migration.noDecks')}</Text>
                )}
              </Card>
              {preview.sameNames.length ? (
                <Card>
                  <Text>
                    {t('migration.sameNames', {
                      names: preview.sameNames.join(language === 'fa' ? '، ' : ', '),
                    })}
                  </Text>
                </Card>
              ) : null}
              <Text tone="secondary">{t('migration.supported')}</Text>
              <FeedbackModal
                message={preview.blockers
                  .map((blocker) =>
                    guestTransferFeedback(blocker, language, t, 'migration.blocked'),
                  )
                  .join('\n\n')}
                eventKey={preview}
                onRetry={() => void load()}
                retryLabel={t('migration.retry')}
              />
              {preview.guest.length ? (
                <View className="gap-sm">
                  <Button
                    label={t(preview.journal === 'pending' ? 'migration.resume' : 'migration.add')}
                    loading={busy}
                    disabled={
                      busy ||
                      !preview.accountVerified ||
                      (!!preview.blockers.length && preview.journal !== 'pending')
                    }
                    onPress={() => void transfer()}
                  />
                  <Text tone="secondary">
                    {t(
                      preview.journal === 'pending' ? 'migration.resumeHint' : 'migration.addHint',
                    )}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}
          {preview &&
          preview.journal !== 'pending' &&
          (preview.hasGuestData ?? preview.guest.length > 0) ? (
            <>
              <Button
                label={t('migration.discard')}
                variant="destructive"
                disabled={busy}
                onPress={() => {
                  if (!submitting.current) setConfirmDiscard(true);
                }}
              />
              <Text tone="secondary">{t('migration.discardHint')}</Text>
            </>
          ) : null}
          {confirmDiscard ? (
            <ConfirmationPanel
              title={t('migration.discardTitle')}
              description={t('migration.discardHint')}
              cancelLabel={t('common.cancel')}
              confirmLabel={t('migration.discardConfirm')}
              busy={busy}
              onCancel={() => setConfirmDiscard(false)}
              onConfirm={() => void discard()}
            />
          ) : null}
          <Button
            label={t('account.logout')}
            variant="secondary"
            disabled={busy}
            onPress={() => {
              if (!submitting.current) setConfirmLogout(true);
            }}
          />
          {confirmLogout ? (
            <ConfirmationPanel
              title={t('logout.title')}
              description={t('logout.confirm')}
              cancelLabel={t('common.cancel')}
              confirmLabel={t('logout.withoutBackup')}
              busy={busy}
              onCancel={() => setConfirmLogout(false)}
              onConfirm={() => void logout()}
            />
          ) : null}
        </View>
      </Screen>
    </Modal>
  );
}
