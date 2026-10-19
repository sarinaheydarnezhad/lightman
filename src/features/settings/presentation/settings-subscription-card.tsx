import { useCallback, useSyncExternalStore } from 'react';
import { router } from 'expo-router';
import { syncEngine } from '@/core/composition/sync';
import { learningAccess } from '@/core/composition/learning-access';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import { LoadingState } from '@/shared/ui/loading-state';

export function SettingsSubscriptionCard() {
  const { t, language } = useLocalization();
  const access = learningAccess();
  const state = useSyncExternalStore(access.subscribe, access.snapshot);
  const metadata = useFocusedResource(
    useCallback(async () => {
      if (!access.isAccount || !syncEngine?.available) throw new Error('Unavailable');
      await access.refresh();
      return { subscription: (await syncEngine.subscription()).subscription };
    }, [access]),
  );
  const confirmed =
    !metadata.loading &&
    !metadata.error &&
    !!metadata.data &&
    !state.provisional &&
    !!state.entitlements;
  const entitlements = confirmed ? state.entitlements : null;
  const subscription = confirmed ? metadata.data?.subscription : null;
  const expired =
    !!entitlements &&
    !entitlements.isActive &&
    !!entitlements.expiresAtUtc &&
    Date.parse(entitlements.expiresAtUtc) <= Date.parse(entitlements.validatedAtUtc);
  const status = !entitlements
    ? t('access.unknown')
    : entitlements.isActive
      ? t('paywall.active')
      : expired
        ? t('paywall.status.Expired')
        : subscription && subscription.status !== 'Active'
          ? t(`paywall.status.${subscription.status}`)
          : t('paywall.free');
  const localTime = (value: string) =>
    new Date(value).toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US');
  return (
    <Card className="gap-md" testID="settings-subscription-card">
      <Text variant="headingSmall" accessibilityRole="header">
        {t('account.subscription')}
      </Text>
      {metadata.loading ? <LoadingState label={t('access.refresh')} /> : null}
      <Text accessibilityLiveRegion="polite">{t('paywall.status', { status })}</Text>
      {entitlements ? (
        <>
          <Text>
            {t('access.current', {
              plan: t(entitlements.isActive ? 'account.plusPlan' : 'account.freePlan'),
            })}
          </Text>
          {entitlements.startsAtUtc ? (
            <Text>{t('account.starts', { time: localTime(entitlements.startsAtUtc) })}</Text>
          ) : null}
          {entitlements.expiresAtUtc ? (
            <Text>{t('access.expires', { time: localTime(entitlements.expiresAtUtc) })}</Text>
          ) : null}
          {expired ? <Text>{t('paywall.expired')}</Text> : null}
          <Text>
            {t(
              entitlements.isActive
                ? 'access.plus'
                : entitlements.withinFreeTierLimits
                  ? 'access.free'
                  : 'access.restricted',
            )}
          </Text>
          {entitlements.isActive ? <Text>{t('account.activePurchaseBlocked')}</Text> : null}
        </>
      ) : null}
      {!metadata.loading && !confirmed ? (
        <Text tone="warning" accessibilityRole="alert">
          {t('account.subscriptionUnknown')}
        </Text>
      ) : null}
      <Button
        label={t('access.plans')}
        variant="secondary"
        onPress={() => router.push('/settings/subscription' as import('expo-router').Href)}
      />
      {!metadata.loading && !confirmed ? (
        <Button label={t('access.refresh')} variant="secondary" onPress={metadata.refresh} />
      ) : null}
    </Card>
  );
}
