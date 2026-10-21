import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { syncEngine } from '@/core/composition/sync';
import { storageScopes } from '@/core/composition/repositories';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Screen } from '@/shared/ui/screen';
import { PageTitle } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { Button } from '@/shared/ui/button';

type Status =
  NonNullable<typeof syncEngine> extends { status(): Promise<infer Result> } ? Result : never;

export function CloudSyncScreen() {
  const { t, number } = useLocalization();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (syncEngine) {
      const next = await syncEngine.status();
      setStatus(next);
      if (next.sessionError) setError(next.sessionError);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refresh().catch(() => setError(t('sync.error')));
    }, [refresh, t]),
  );

  async function perform(action: () => Promise<void>): Promise<void> {
    if (!syncEngine || busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('sync.error'));
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll keyboardAware>
      <View className="gap-lg">
        <PageTitle>{t('sync.title')}</PageTitle>
        <Text tone="secondary">{t('sync.description')}</Text>
        {storageScopes.snapshot().mode === 'guest' && (
          <Text tone="secondary">{t('guest.explanation')}</Text>
        )}
        {!syncEngine?.available ? (
          <Text>{t('sync.unavailable')}</Text>
        ) : (
          <>
            {status?.signedIn ? (
              <>
                <Text>{t('sync.account', { id: status.userId })}</Text>
                <Text>
                  {t('sync.progress', {
                    cursor: number(status.cursor),
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
                  variant="secondary"
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
              <View className="gap-sm">
                <Text tone="warning">{t('sync.failed', { count: number(status.failed) })}</Text>
                <Button
                  label={t('sync.retry')}
                  variant="secondary"
                  disabled={busy}
                  onPress={() => void perform(() => syncEngine!.retryFailed())}
                />
              </View>
            )}
            {status?.conflicts.map((conflict) => (
              <View className="gap-sm" key={conflict.operationId}>
                <Text tone="warning">
                  {t('sync.conflict', { type: conflict.entityType, id: conflict.entityId })}
                </Text>
                {conflict.entityType === 'reviewState' || conflict.entityType === 'reviewEvent' ? (
                  <Text>{t('sync.reviewConflict')}</Text>
                ) : (
                  <View className="gap-sm">
                    <Button
                      label={t('sync.keepServer')}
                      variant="secondary"
                      disabled={busy}
                      onPress={() =>
                        void perform(() => syncEngine!.resolve(conflict.operationId, 'server'))
                      }
                    />
                    {conflict.archived ? (
                      <Text>{t('sync.deleted')}</Text>
                    ) : (
                      <Button
                        label={t('sync.keepLocal')}
                        variant="secondary"
                        disabled={busy}
                        onPress={() =>
                          void perform(() => syncEngine!.resolve(conflict.operationId, 'local'))
                        }
                      />
                    )}
                  </View>
                )}
              </View>
            ))}
          </>
        )}
        {error ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
