import { useCallback, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { router } from 'expo-router';
import { storageScopes } from '@/core/composition/repositories';
import { syncEngine } from '@/core/composition/sync';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';
import { useLocalization } from '@/shared/localization/localization-provider';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { icons, spacing } from '@/shared/theme/tokens';
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
  const { t, direction } = useLocalization();
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
      <View
        className={`items-center gap-md ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}
      >
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <UserRound size={icons.medium} color={colors.secondaryText} />
        </View>
        <View className="min-w-0 flex-1 gap-xs">
          <Text variant="headingSmall" accessibilityRole="header">
            {t('settings.account')}
          </Text>
          <Text variant="bodySmall" tone="secondary">
            {t('settings.accountSubtitle')}
          </Text>
        </View>
      </View>
      {scope.phase !== 'ready' ? (
        <LoadingState label={t('guest.switching')} />
      ) : userId ? (
        <AccountDetails key={`${userId}:${scope.revision}`} userId={userId} />
      ) : (
        <View className="gap-sm">
          <Button label={t('account.loginSignup')} onPress={() => router.push('/auth')} />
          <Button
            label={t('settings.upgradePlus')}
            variant="secondary"
            onPress={() => router.push('/settings/subscription' as import('expo-router').Href)}
          />
        </View>
      )}
    </Card>
  );
}
