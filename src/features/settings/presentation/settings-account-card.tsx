import { useCallback, useSyncExternalStore } from 'react';
import { router } from 'expo-router';
import { storageScopes } from '@/core/composition/repositories';
import { syncEngine } from '@/core/composition/sync';
import { freeLearningLimits } from '@/core/access/learning-access';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { LoadingState } from '@/shared/ui/loading-state';
import { Text } from '@/shared/ui/text';
import { SettingsBackupCard } from './settings-backup-card';
import { SettingsSubscriptionCard } from './settings-subscription-card';

function AccountDetails({ userId }: { userId: string }) {
  const { t } = useLocalization();
  const profile = useFocusedResource(
    useCallback(async () => {
      if (!syncEngine?.available) throw new Error('Unavailable');
      const account = await syncEngine.accountProfile();
      if (account.id !== userId) throw new Error('Account changed');
      const digits = account.phoneNumber?.replace(/\D/g, '') ?? '';
      return {
        displayName: account.displayName,
        contact: digits.length >= 2 ? `•••• ••${digits.slice(-2)}` : account.email,
      };
    }, [userId]),
  );
  return (
    <>
      <Text>{t('account.signedIn')}</Text>
      {profile.loading ? <LoadingState label={t('account.loading')} /> : null}
      {profile.data && !profile.error ? (
        <>
          <Text variant="labelLarge">
            {profile.data.displayName.trim() || t('account.noUsername')}
          </Text>
          {profile.data.contact ? <Text tone="secondary">{profile.data.contact}</Text> : null}
        </>
      ) : null}
      {profile.error ? (
        <>
          <Text tone="error" accessibilityRole="alert">
            {t('account.error')}
          </Text>
          <Button
            label={t('account.retry')}
            variant="secondary"
            loading={profile.loading}
            onPress={profile.refresh}
          />
        </>
      ) : null}
      <SettingsSubscriptionCard />
      <SettingsBackupCard />
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
        label={t('account.logout')}
        variant="secondary"
        onPress={() => router.push('/settings/logout' as import('expo-router').Href)}
      />
    </>
  );
}

export function SettingsAccountCard() {
  const { t, number } = useLocalization();
  const scope = useSyncExternalStore(storageScopes.subscribe, storageScopes.snapshot);
  const userId = scope.phase === 'ready' && scope.mode === 'account' ? scope.userId : null;
  return (
    <Card className="gap-md" testID="settings-account-card">
      <Text variant="headingSmall" accessibilityRole="header">
        {t('settings.account')}
      </Text>
      {scope.phase !== 'ready' ? (
        <LoadingState label={t('guest.switching')} />
      ) : userId ? (
        <AccountDetails key={`${userId}:${scope.revision}`} userId={userId} />
      ) : (
        <>
          <Text variant="labelLarge">{t('guest.mode')}</Text>
          <Text tone="secondary">{t('account.guestLocal')}</Text>
          <Text>
            {t('account.guestLimits', {
              decks: number(freeLearningLimits.decks),
              cards: number(freeLearningLimits.cards),
            })}
          </Text>
          <Button label={t('account.loginSignup')} onPress={() => router.push('/auth')} />
          <Button
            label={t('settings.upgradePlus')}
            variant="secondary"
            onPress={() => router.push('/settings/subscription' as import('expo-router').Href)}
          />
        </>
      )}
    </Card>
  );
}
