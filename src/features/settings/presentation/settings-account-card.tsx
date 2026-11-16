import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FeedbackNotice } from '@/shared/ui/feedback-notice';
import { View } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { router } from 'expo-router';
import { storageScopes } from '@/core/composition/repositories';
import { syncEngine } from '@/core/composition/sync';
import type { AccountProfile } from '@/core/sync/cloud-client';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';
import { useLocalization } from '@/shared/localization/localization-provider';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { heights, icons, radii, spacing } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { LoadingState } from '@/shared/ui/loading-state';
import { Text } from '@/shared/ui/text';
import { SettingsSubscriptionCard } from './settings-subscription-card';

function AccountNameEditor({ profile }: { profile: AccountProfile }) {
  const { t, direction } = useLocalization();
  const colors = useThemeColors();
  const textAlign = direction === 'rtl' ? 'right' : 'left';
  const [savedName, setSavedName] = useState(profile.displayName);
  const [name, setName] = useState(profile.displayName);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<'invalid' | 'save' | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function save() {
    if (submitting.current || !syncEngine?.available) return;
    const displayName = name.trim();
    if (!displayName || displayName.length > 120) {
      setError('invalid');
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      const account = await syncEngine.updateAccountName(displayName);
      if (account.id !== profile.id || account.displayName !== displayName)
        throw new Error('Account name was not saved');
      if (mounted.current) {
        setSavedName(account.displayName);
        setName(account.displayName);
        setEditing(false);
      }
    } catch {
      if (mounted.current) setError('save');
    } finally {
      submitting.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <>
      <View
        testID="account-header"
        style={{
          flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{
            width: heights.button,
            height: heights.button,
            borderRadius: radii.full,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <UserRound size={icons.large} color={colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
          <Text variant="headingSmall" style={{ textAlign }}>
            {savedName || t('account.noUsername')}
          </Text>
          {profile.phoneNumber || profile.email ? (
            <Text
              variant="bodySmall"
              tone="secondary"
              style={{ textAlign, writingDirection: 'ltr' }}
            >
              {profile.phoneNumber || profile.email}
            </Text>
          ) : null}
        </View>
      </View>
      <View
        testID="account-divider"
        style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }}
      />
      <View className="gap-md">
        {editing ? (
          <>
            <Input
              label={t('onboarding.nameLabel')}
              error={error === 'invalid' ? t('onboarding.nameInvalid') : undefined}
              value={name}
              onChangeText={(value) => {
                setName(value);
                setError(null);
              }}
              disabled={saving}
              maxLength={120}
              autoComplete="name"
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => void save()}
            />
            <Button label={t('account.saveName')} loading={saving} onPress={() => void save()} />
            <Button
              label={t('common.cancel')}
              variant="secondary"
              disabled={saving}
              onPress={() => {
                setName(savedName);
                setError(null);
                setEditing(false);
              }}
            />
          </>
        ) : (
          <Button
            label={t('account.editName')}
            variant="secondary"
            onPress={() => setEditing(true)}
          />
        )}
        {error === 'save' ? (
          <FeedbackNotice
            message={t('onboarding.nameSaveError')}
            onDismiss={() => setError(null)}
          />
        ) : null}
      </View>
    </>
  );
}

function AccountDetails({ userId }: { userId: string }) {
  const { t } = useLocalization();
  const profile = useFocusedResource(
    useCallback(async () => {
      if (!syncEngine?.available) throw new Error('Unavailable');
      const account = await syncEngine.accountProfile();
      if (account.id !== userId) throw new Error('Account changed');
      return account;
    }, [userId]),
  );
  return (
    <>
      {profile.loading ? <LoadingState label={t('account.loading')} /> : null}
      {profile.data && !profile.error ? (
        <AccountNameEditor key={profile.data.displayName} profile={profile.data} />
      ) : null}
      {profile.error ? (
        <FeedbackNotice
          message={t('account.error')}
          onRetry={profile.refresh}
          retryLabel={t('account.retry')}
        />
      ) : null}
      <SettingsSubscriptionCard />
      <Button
        label={t('account.logout')}
        variant="destructive"
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
          <Text variant="bodySmall" tone="secondary">
            {t('account.purchaseLoginHint')}
          </Text>
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
