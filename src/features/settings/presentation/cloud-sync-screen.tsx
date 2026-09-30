import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { syncEngine } from '@/core/composition/sync';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';

type Status = NonNullable<typeof syncEngine> extends { status(): Promise<infer Result> } ? Result : never;

export function CloudSyncScreen() {
  const { t, number } = useLocalization();
  const [status, setStatus] = useState<Status | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (syncEngine) setStatus(await syncEngine.status());
  }, []);
  useFocusEffect(useCallback(() => { void refresh().catch(() => setError(t('sync.error'))); }, [refresh, t]));

  async function perform(action: () => Promise<void>): Promise<void> {
    if (!syncEngine || busy) return;
    setBusy(true);
    setError('');
    try { await action(); await refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t('sync.error')); }
    finally { setBusy(false); }
  }

  const signIn = (register: boolean) => perform(async () => {
    await syncEngine!.signIn(email.trim(), password, register ? displayName.trim() : undefined);
    setPassword('');
    void syncEngine!.syncNow().catch(() => {});
  });

  return (
    <Screen scroll keyboardAware>
      <View className="gap-lg">
        <Text variant="headingLarge">{t('sync.title')}</Text>
        <Text tone="secondary">{t('sync.description')}</Text>
        {!syncEngine?.available ? <Text>{t('sync.unavailable')}</Text> : (
          <>
            {status?.signedIn ? (
              <>
                <Text>{t('sync.account', { id: status.userId })}</Text>
                <Text>{t('sync.progress', { cursor: number(status.cursor), count: number(status.pending) })}</Text>
                <Button label={t('sync.now')} loading={busy} onPress={() => void perform(() => syncEngine!.syncNow())} />
                <Button label={t('sync.signOut')} variant="secondary" disabled={busy}
                  onPress={() => void perform(() => syncEngine!.signOut())} />
              </>
            ) : (
              <>
                <Input label={t('sync.email')} value={email} onChangeText={setEmail}
                  autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
                <Input label={t('sync.password')} value={password} onChangeText={setPassword}
                  secureTextEntry autoCapitalize="none" autoComplete="password" />
                <Input label={t('sync.name')} value={displayName} onChangeText={setDisplayName} />
                <Button label={t('sync.signIn')} loading={busy} onPress={() => void signIn(false)} />
                <Button label={t('sync.register')} variant="secondary" disabled={busy}
                  onPress={() => void signIn(true)} />
              </>
            )}
            {!!status?.failed && (
              <View className="gap-sm">
                <Text tone="warning">{t('sync.failed', { count: number(status.failed) })}</Text>
                <Button label={t('sync.retry')} variant="secondary" disabled={busy}
                  onPress={() => void perform(() => syncEngine!.retryFailed())} />
              </View>
            )}
            {status?.conflicts.map((conflict) => (
              <View className="gap-sm" key={conflict.operationId}>
                <Text tone="warning">{t('sync.conflict', { type: conflict.entityType, id: conflict.entityId })}</Text>
                {conflict.entityType === 'reviewState' || conflict.entityType === 'reviewEvent' ? (
                  <Text>{t('sync.reviewConflict')}</Text>
                ) : (
                  <View className="gap-sm">
                    <Button label={t('sync.keepServer')} variant="secondary" disabled={busy}
                      onPress={() => void perform(() => syncEngine!.resolve(conflict.operationId, 'server'))} />
                    {conflict.archived ? <Text>{t('sync.archived')}</Text> : (
                      <Button label={t('sync.keepLocal')} variant="secondary" disabled={busy}
                        onPress={() => void perform(() => syncEngine!.resolve(conflict.operationId, 'local'))} />
                    )}
                  </View>
                )}
              </View>
            ))}
          </>
        )}
        {error ? <Text tone="error" accessibilityLiveRegion="polite">{error}</Text> : null}
      </View>
    </Screen>
  );
}
