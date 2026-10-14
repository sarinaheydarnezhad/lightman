import { useCallback, useState, useSyncExternalStore } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { storageScopes } from '@/core/composition/repositories';
import { syncEngine } from '@/core/composition/sync';
import type { AccountProfile } from '@/core/sync/cloud-client';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { LoadingState } from '@/shared/ui/loading-state';
import { Text } from '@/shared/ui/text';

export function SettingsAccountCard() {
  const { t } = useLocalization();
  const scope = useSyncExternalStore(storageScopes.subscribe, storageScopes.snapshot);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const userId = scope.phase === 'ready' && scope.mode === 'account' ? scope.userId : null;
  const currentProfile = userId && profile?.id === userId ? profile : null;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setProfile(null);
      if (userId && syncEngine?.available)
        void syncEngine
          .accountProfile()
          .then((account) => {
            if (active && account.id === userId) setProfile(account);
          })
          .catch(() => {});
      return () => {
        active = false;
      };
    }, [userId]),
  );

  return (
    <Card className="gap-md" testID="settings-account-card">
      <Text variant="headingSmall" accessibilityRole="header">
        {t('settings.account')}
      </Text>
      {scope.phase !== 'ready' ? (
        <LoadingState label={t('guest.switching')} />
      ) : userId ? (
        <>
          <Text variant="labelLarge">
            {currentProfile?.displayName.trim() || t('auth.success')}
          </Text>
          <Text tone="secondary">
            {currentProfile?.phoneNumber ||
              currentProfile?.email ||
              t('sync.account', { id: userId })}
          </Text>
          <Button
            label={t('sync.title')}
            variant="secondary"
            onPress={() => router.push('/settings/cloud')}
          />
          <Button
            label={t('migration.title')}
            variant="secondary"
            onPress={() => router.push('/auth/guest-data' as import('expo-router').Href)}
          />
          <Button
            label={t('sync.signOut')}
            variant="secondary"
            onPress={() => router.push('/settings/logout' as import('expo-router').Href)}
          />
        </>
      ) : (
        <>
          <Text tone="secondary">{t('guest.mode')}</Text>
          <Button label={t('sync.signIn')} onPress={() => router.push('/auth')} />
        </>
      )}
    </Card>
  );
}
