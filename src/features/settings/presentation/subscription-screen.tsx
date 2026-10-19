import { useCallback, useState, useSyncExternalStore } from 'react';
import { router } from 'expo-router';
import { syncEngine } from '@/core/composition/sync';
import { storageScopes } from '@/core/composition/repositories';
import { learningAccess } from '@/core/composition/learning-access';
import { freeLearningLimits, localLearningUsage } from '@/core/access/learning-access';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { LoadingState } from '@/shared/ui/loading-state';
import { stackScreenEdges } from '@/shared/navigation/safe-area';

export function SubscriptionScreen() {
  const { t, number, language } = useLocalization();
  const access = learningAccess();
  const state = useSyncExternalStore(access.subscribe, access.snapshot);
  const [trigger] = useState(() => state.restriction);
  const [selectedMonths, setSelectedMonths] = useState<number | null>(null);
  const catalog = useFocusedResource(
    useCallback(async () => {
      if (!syncEngine?.available) throw new Error('Cloud unavailable');
      return syncEngine.planCatalog();
    }, []),
  );
  const details = useFocusedResource(
    useCallback(async () => {
      const scope = storageScopes.current();
      const revision = storageScopes.snapshot().revision;
      await access.refresh();
      const usage = await localLearningUsage(scope.value)();
      const subscription = access.isAccount
        ? (await syncEngine!.subscription()).subscription
        : null;
      storageScopes.assertCurrent(scope, revision);
      return { usage, subscription };
    }, [access]),
  );
  const plus = catalog.data?.plans.find((plan) => plan.plan === 'Plus');
  const prices = plus?.prices ?? [];
  const selected = prices.find((price) => price.durationMonths === selectedMonths) ?? prices[0];
  const usage = details.data
    ? {
        decks: Math.max(details.data.usage.decks, state.entitlements?.usage.decks ?? 0),
        cards: Math.max(details.data.usage.cards, state.entitlements?.usage.cards ?? 0),
      }
    : null;
  const withinLimits = usage
    ? usage.decks <= freeLearningLimits.decks && usage.cards <= freeLearningLimits.cards
    : null;
  const subscription = details.data?.subscription;
  const active = state.entitlements?.isActive === true;
  const restriction = active ? undefined : (trigger ?? state.restriction);
  const status = !access.isAccount
    ? t('guest.mode')
    : active
      ? t(state.provisional ? 'paywall.activeProvisional' : 'paywall.active')
      : state.provisional
        ? t('access.unknown')
        : subscription
          ? t(`paywall.status.${subscription.status}`)
          : t('paywall.free');
  const expires = state.entitlements?.expiresAtUtc ?? subscription?.expiresAtUtc;
  const refresh = () => {
    if (catalog.loading || details.loading) return;
    catalog.refresh();
    details.refresh();
  };
  return (
    <Screen edges={stackScreenEdges} scroll testID="plus-paywall">
      <Card className="gap-md">
        <Text variant="headingLarge" accessibilityRole="header">
          {t('paywall.title')}
        </Text>
        <Text>{t(access.isAccount ? 'guest.accountMode' : 'guest.mode')}</Text>
        <Text accessibilityLiveRegion="polite">{t('paywall.status', { status })}</Text>
        {expires ? (
          <Text>
            {t('access.expires', {
              time: new Date(expires).toLocaleString(language === 'fa' ? 'fa-IR' : 'en-US'),
            })}
          </Text>
        ) : null}
        {access.isAccount && state.provisional ? (
          <Text tone="warning">{t('access.provisional')}</Text>
        ) : null}
        {usage ? (
          <>
            <Text>
              {t('paywall.usage', { decks: number(usage.decks), cards: number(usage.cards) })}
            </Text>
            <Text>{t(withinLimits ? 'paywall.withinLimits' : 'paywall.overLimits')}</Text>
          </>
        ) : null}
        {restriction ? (
          <Card className="gap-sm" testID="paywall-reason">
            <Text variant="labelLarge">{t('paywall.reason')}</Text>
            {restriction.operation === 'study' ? <Text>{t('paywall.studyReason')}</Text> : null}
            {restriction.decks ? <Text>{t('paywall.deckReason')}</Text> : null}
            {restriction.cards ? <Text>{t('paywall.cardReason')}</Text> : null}
          </Card>
        ) : null}
        {subscription?.status === 'Expired' ? <Text>{t('paywall.expired')}</Text> : null}
        <Text>{t('access.free')}</Text>
        <Text variant="headingSmall">{t('paywall.benefits')}</Text>
        <Text>{t('paywall.unlimited')}</Text>
        <Text>{t('paywall.study')}</Text>
        <Text tone="secondary">
          {t(syncEngine?.available ? 'paywall.cloud' : 'paywall.cloudUnavailable')}
        </Text>
        <Text variant="headingSmall">{t('paywall.choose')}</Text>
        {catalog.loading ? <LoadingState label={t('paywall.loading')} /> : null}
        {catalog.error ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {t('access.unavailable')}
          </Text>
        ) : null}
        {!catalog.loading && !catalog.error && !prices.length ? (
          <Text>{t('paywall.empty')}</Text>
        ) : null}
        {!catalog.loading && !catalog.error
          ? prices.map((price) => (
              <Button
                key={price.durationMonths}
                testID={`plus-plan-${price.durationMonths}`}
                label={t(price.durationMonths === 1 ? 'paywall.monthPrice' : 'access.price', {
                  months: number(price.durationMonths),
                  amount: number(price.priceToman),
                })}
                variant={
                  selected?.durationMonths === price.durationMonths ? 'primary' : 'secondary'
                }
                accessibilityState={{ selected: selected?.durationMonths === price.durationMonths }}
                onPress={() => setSelectedMonths(price.durationMonths)}
              />
            ))
          : null}
        {selected && !catalog.loading && !catalog.error ? (
          <Text testID="selected-plan">
            {t(selected.durationMonths === 1 ? 'paywall.monthTotal' : 'paywall.total', {
              months: number(selected.durationMonths),
              amount: number(selected.priceToman),
            })}
          </Text>
        ) : null}
        <Button label={t('paywall.purchaseUnavailable')} disabled />
        <Text>{t(active ? 'paywall.alreadyActive' : 'paywall.providerMissing')}</Text>
        <Text tone="secondary">{t('access.fullUnavailable')}</Text>
        {!access.isAccount ? (
          <Button label={t('sync.signIn')} onPress={() => router.push('/auth')} />
        ) : null}
        {details.loading ? <LoadingState label={t('access.refresh')} /> : null}
        {details.error ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {t('paywall.statusError')}
          </Text>
        ) : null}
        <Button
          label={t('access.refresh')}
          variant="secondary"
          loading={catalog.loading || details.loading}
          onPress={refresh}
        />
      </Card>
    </Screen>
  );
}
