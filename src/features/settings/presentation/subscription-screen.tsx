import { useCallback, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { BookOpen, Crown, Layers, RectangleHorizontal, type LucideIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import { syncEngine } from '@/core/composition/sync';
import { storageScopes } from '@/core/composition/repositories';
import { learningAccess } from '@/core/composition/learning-access';
import { freeLearningLimits, localLearningUsage } from '@/core/access/learning-access';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Screen } from '@/shared/ui/screen';
import { PageTitle } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { LoadingState } from '@/shared/ui/loading-state';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { icons } from '@/shared/theme/tokens';

function PlanFeature({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const { direction } = useLocalization();
  const colors = useThemeColors();
  return (
    <View className={`items-start gap-md ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" className="pt-xs">
        <Icon size={icons.medium} color={colors.primary} />
      </View>
      <Text className="min-w-0 flex-1" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

export function SubscriptionScreen() {
  const { t, number, language, direction } = useLocalization();
  const colors = useThemeColors();
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
      <View className="gap-lg">
        <PageTitle>{t('paywall.title')}</PageTitle>
        <Card variant="outlined" style={{ backgroundColor: colors.primarySoft }}>
          <View
            className={`items-start gap-lg ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <View className="min-w-0 flex-1 gap-sm">
              <Text variant="headingSmall" weight="bold" accessibilityRole="header">
                {t('paywall.introTitle')}
              </Text>
              <Text variant="bodySmall" tone="secondary">
                {t('paywall.introDescription')}
              </Text>
            </View>
            <View
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              className="min-h-iconButton min-w-iconButton items-center justify-center rounded-full bg-surface"
            >
              <Crown size={icons.large} color={colors.primary} />
            </View>
          </View>
        </Card>

        <Card
          variant="outlined"
          className="gap-lg"
          style={{ backgroundColor: colors.surface }}
          testID="free-plan"
        >
          <Text variant="headingSmall" accessibilityRole="header">
            {t('account.freePlan')}
          </Text>
          <View className="gap-md">
            <PlanFeature
              icon={Layers}
              label={t('paywall.freeDecks', { count: number(freeLearningLimits.decks) })}
            />
            <PlanFeature
              icon={RectangleHorizontal}
              label={t('paywall.freeCards', { count: number(freeLearningLimits.cards) })}
            />
            <PlanFeature icon={BookOpen} label={t('paywall.freeStudy')} />
          </View>
        </Card>

        <Card
          variant="outlined"
          className="gap-lg"
          style={{ backgroundColor: colors.surface, borderColor: colors.primary }}
          testID="plus-plan"
        >
          <View
            className={`flex-wrap items-center justify-between gap-sm ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <Text variant="headingSmall" accessibilityRole="header" className="flex-shrink">
              {t('paywall.plusPlan')}
            </Text>
            <Badge label={t('account.plusPlan')} variant="primary" />
          </View>
          <View className="gap-md">
            <PlanFeature icon={Layers} label={t('paywall.plusDecks')} />
            <PlanFeature icon={RectangleHorizontal} label={t('paywall.plusCards')} />
            <PlanFeature icon={BookOpen} label={t('paywall.study')} />
          </View>
        </Card>

        <Card variant="outlined" className="gap-md" style={{ backgroundColor: colors.surface }}>
          <Text variant="headingSmall" accessibilityRole="header">
            {t('paywall.choose')}
          </Text>
          {catalog.loading ? <LoadingState label={t('paywall.loading')} /> : null}
          {catalog.error ? (
            <Text tone="error" accessibilityLiveRegion="polite">
              {t('access.unavailable')}
            </Text>
          ) : null}
          {!catalog.loading && !catalog.error && !prices.length ? (
            <Text tone="secondary">{t('paywall.empty')}</Text>
          ) : null}
          {!catalog.loading && !catalog.error
            ? prices.map((price) => (
                <Button
                  key={price.durationMonths}
                  testID={`plus-plan-${price.durationMonths}`}
                  label={t(price.durationMonths === 1 ? 'paywall.monthPrice' : 'access.price', {
                    months: number(price.durationMonths),
                    amount:
                      language === 'fa'
                        ? `\u2066${number(price.priceToman)}\u2069`
                        : number(price.priceToman),
                  })}
                  variant={
                    selected?.durationMonths === price.durationMonths ? 'primary' : 'secondary'
                  }
                  accessibilityState={{
                    selected: selected?.durationMonths === price.durationMonths,
                  }}
                  onPress={() => setSelectedMonths(price.durationMonths)}
                />
              ))
            : null}
          {selected && !catalog.loading && !catalog.error ? (
            <Text variant="labelLarge" testID="selected-plan">
              {t(selected.durationMonths === 1 ? 'paywall.monthTotal' : 'paywall.total', {
                months: number(selected.durationMonths),
                amount: number(selected.priceToman),
              })}
            </Text>
          ) : null}
          <Button label={t('paywall.purchaseUnavailable')} disabled />
          <View className="gap-sm rounded-md bg-primarySoft p-md">
            <Text variant="bodySmall" tone="secondary">
              {t(active ? 'paywall.alreadyActive' : 'paywall.providerMissing')}
            </Text>
            <Text variant="caption" tone="secondary">
              {t('access.fullUnavailable')}
            </Text>
          </View>
        </Card>

        <Card variant="outlined" className="gap-md" style={{ backgroundColor: colors.surface }}>
          <Text variant="headingSmall" accessibilityRole="header">
            {t('account.subscription')}
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
            <View
              className="gap-sm rounded-md border border-border bg-background p-md"
              testID="paywall-reason"
            >
              <Text variant="labelLarge">{t('paywall.reason')}</Text>
              {restriction.operation === 'study' ? <Text>{t('paywall.studyReason')}</Text> : null}
              {restriction.decks ? <Text>{t('paywall.deckReason')}</Text> : null}
              {restriction.cards ? <Text>{t('paywall.cardReason')}</Text> : null}
            </View>
          ) : null}
          {subscription?.status === 'Expired' ? <Text>{t('paywall.expired')}</Text> : null}
          <Text variant="bodySmall" tone="secondary">
            {t('paywall.dataPreserved')}
          </Text>
          <Text variant="bodySmall" tone="secondary">
            {t(syncEngine?.available ? 'paywall.cloud' : 'paywall.cloudUnavailable')}
          </Text>
          {details.loading ? <LoadingState label={t('access.refresh')} /> : null}
          {details.error ? (
            <Text tone="error" accessibilityLiveRegion="polite">
              {t('paywall.statusError')}
            </Text>
          ) : null}
        </Card>
        <Button
          label={t('access.refresh')}
          variant="secondary"
          loading={catalog.loading || details.loading}
          onPress={refresh}
        />
        {!access.isAccount ? (
          <Button
            label={t('sync.signIn')}
            variant="tertiary"
            onPress={() => router.push('/auth')}
          />
        ) : null}
      </View>
    </Screen>
  );
}
