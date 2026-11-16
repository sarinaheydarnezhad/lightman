import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FeedbackNotice } from '@/shared/ui/feedback-notice';
import { router, useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { syncEngine } from '@/core/composition/sync';
import { CloudError } from '@/core/sync/cloud-client';
import { storageScopes } from '@/core/composition/repositories';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Screen } from '@/shared/ui/screen';
import { PageTitle } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { Button } from '@/shared/ui/button';
import { SettingsBackupCard } from './settings-backup-card';
import type { StorageState } from '@/core/storage/local-storage-scopes';
import type { MessageKey } from '@/shared/localization/messages';

type Status =
  NonNullable<typeof syncEngine> extends { status(): Promise<infer Result> } ? Result : never;

function ConflictNotice({
  conflict,
  busy,
  resolve,
}: {
  conflict: Status['conflicts'][number];
  busy: boolean;
  resolve: (choice: 'server' | 'local') => void;
}) {
  const { t } = useLocalization();
  const message = t('sync.conflict', { type: conflict.entityType, id: conflict.entityId });
  return (
    <FeedbackNotice message={message} tone="warning" eventKey={conflict.operationId}>
      {conflict.entityType === 'reviewState' || conflict.entityType === 'reviewEvent' ? (
        <Text>{t('sync.reviewConflict')}</Text>
      ) : (
        <View className="gap-sm">
          <Button
            label={t('sync.keepServer')}
            variant="secondary"
            disabled={busy}
            onPress={() => resolve('server')}
          />
          {conflict.archived ? (
            <Text>{t('sync.deleted')}</Text>
          ) : (
            <Button
              label={t('sync.keepLocal')}
              variant="secondary"
              disabled={busy}
              onPress={() => resolve('local')}
            />
          )}
        </View>
      )}
    </FeedbackNotice>
  );
}

export function CloudSyncScreen() {
  const scope = useSyncExternalStore(storageScopes.subscribe, storageScopes.snapshot);
  return (
    <CloudSyncContent
      key={`${scope.phase}:${scope.mode}:${scope.mode === 'account' ? scope.userId : ''}:${scope.revision}`}
      scope={scope}
    />
  );
}

function CloudSyncContent({ scope }: { scope: StorageState }) {
  const { t, number } = useLocalization();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const active = useRef(true);
  const pending = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (syncEngine) {
      const next = await syncEngine.status();
      if (!active.current) return;
      setStatus(next);
      if (next.sessionError) setError('sync.sessionUnconfirmed');
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refresh().catch(() => {
        if (active.current) setError('sync.error');
      });
    }, [refresh]),
  );

  async function perform(action: () => Promise<void>): Promise<void> {
    if (!syncEngine || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (failure) {
      if (!active.current) return;
      setError(
        failure instanceof CloudError && failure.status === 401
          ? 'auth.sessionExpired'
          : 'sync.error',
      );
      await refresh().catch(() => {});
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }

  return (
    <Screen scroll keyboardAware>
      <View className="gap-xl">
        <PageTitle>{t('sync.title')}</PageTitle>
        <Text tone="secondary">{t('sync.description')}</Text>
        {scope.mode === 'guest' && <Text tone="secondary">{t('guest.explanation')}</Text>}
        {!syncEngine?.available ? (
          <FeedbackNotice message={t('sync.unavailable')} tone="info" />
        ) : (
          <>
            {scope.mode === 'account' && status?.signedIn && status.userId === scope.userId ? (
              <>
                <Text>{t('account.signedIn')}</Text>
                <Text>
                  {t('sync.pendingChanges', {
                    count: number(status.pending),
                  })}
                </Text>
                <Button
                  label={t('sync.now')}
                  loading={busy}
                  onPress={() => void perform(() => syncEngine!.syncNow())}
                />
                <Button
                  label={t('sync.signOut')}
                  variant="tertiary"
                  disabled={busy}
                  onPress={() => router.push('/settings/logout' as import('expo-router').Href)}
                />
              </>
            ) : (
              <>
                <Button label={t('sync.signIn')} onPress={() => router.push('/auth')} />
              </>
            )}
            {!!status?.failed && (
              <FeedbackNotice
                message={t('sync.failed', { count: number(status.failed) })}
                tone="warning"
                busy={busy}
                onRetry={() => void perform(() => syncEngine!.retryFailed())}
                retryLabel={t('sync.retry')}
              />
            )}
            {status?.conflicts.map((conflict) => (
              <ConflictNotice
                key={conflict.operationId}
                conflict={conflict}
                busy={busy}
                resolve={(choice) =>
                  void perform(() => syncEngine!.resolve(conflict.operationId, choice))
                }
              />
            ))}
          </>
        )}
        {scope.phase === 'ready' && scope.mode === 'account' ? (
          <SettingsBackupCard key={`${scope.userId}:${scope.revision}`} />
        ) : null}
        {error ? (
          <FeedbackNotice
            message={t(error)}
            busy={busy}
            onRetry={() => void perform(() => syncEngine!.syncNow())}
          />
        ) : null}
      </View>
    </Screen>
  );
}
