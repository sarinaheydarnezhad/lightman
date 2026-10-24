import { useCallback, useSyncExternalStore } from 'react';
import { FeedbackModal } from '@/shared/ui/feedback-modal';
import { View } from 'react-native';
import { router } from 'expo-router';
import { storageScopes } from '@/core/composition/repositories';
import { syncEngine } from '@/core/composition/sync';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';
import { useLocalization } from '@/shared/localization/localization-provider';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { spacing } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { LoadingState } from '@/shared/ui/loading-state';
import { Text } from '@/shared/ui/text';
import { SettingsSubscriptionCard } from './settings-subscription-card';

function AccountDetails({ userId }: { userId: string }) {
  const { t } = useLocalization();
  const profile = useFocusedResource(
    useCallback(async () => {
      if (!syncEngine?.available) throw new Error('Unavailable');
      const account = await syncEngine.accountProfile();
      if (account.id !== userId) throw new Error('Account changed');
      return {
        contact: account.phoneNumber || account.email,
      };
    }, [userId]),
  );
  return (
    <>
      {profile.loading ? <LoadingState label={t('account.loading')} /> : null}
      {profile.data && !profile.error ? (
        profile.data.contact ? (
          <Text variant="labelLarge">{profile.data.contact}</Text>
        ) : null
      ) : null}
      {profile.error ? (
        <FeedbackModal
          message={t('account.error')}
          onRetry={profile.refresh}
          retryLabel={t('account.retry')}
        />
      ) : null}
      <SettingsSubscriptionCard />
      <Button
        label={t('account.logout')}
        variant="tertiary"
        onPress={() => router.push('/settings/logout' as import('expo-router').Href)}
      />
    </>
  );
}

export function SettingsAccountCard() {
  const { t } = useLocalization();
  const colors = useThemeColors();
  const scope = useSyncExternalStore(storageScopes.subscribe, storageScopes.snapshot);
  const userId = scope.phase === 'ready' && scope.mode === 'account' ? scope.userId : null;
  return (
    <Card
      variant="outlined"
      className="gap-md"
      style={{ backgroundColor: colors.surface, padding: spacing.lg }}
      testID="settings-account-card"
    >
      {scope.phase !== 'ready' ? (
        <LoadingState label={t('guest.switching')} />
      ) : userId ? (
        <AccountDetails key={`${userId}:${scope.revision}`} userId={userId} />
      ) : (
        <View className="gap-sm">
          <Button label={t('account.loginSignup')} onPress={() => router.push('/auth')} />
          <Button
            label={t('subscription.title')}
            variant="secondary"
            onPress={() => router.push('/settings/subscription' as import('expo-router').Href)}
          />
        </View>
      )}
    </Card>
  );
}
