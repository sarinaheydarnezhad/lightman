import { useCallback, useState, useSyncExternalStore } from 'react';
import { FeedbackModal } from '@/shared/ui/feedback-modal';
import { View } from 'react-native';
import { BookOpen, Crown, Layers, RectangleHorizontal, type LucideIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import { syncEngine } from '@/core/composition/sync';
import { storageScopes } from '@/core/composition/repositories';
import { learningAccess } from '@/core/composition/learning-access';
import { freeLearningLimits } from '@/core/access/learning-access';
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
      const subscription = access.isAccount
        ? (await syncEngine!.subscription()).subscription
        : null;
      storageScopes.assertCurrent(scope, revision);
      return { subscription };
    }, [access]),
  );
  const plus = catalog.data?.plans.find((plan) => plan.plan === 'Plus');
  const prices = plus?.prices ?? [];
  const regularMonthlyPrice = prices.find((price) => price.durationMonths === 1)?.priceToman;
  const amount = (value: number) =>
    language === 'fa' ? `\u2066${number(value)}\u2069` : number(value);
  const selected = prices.find((price) => price.durationMonths === selectedMonths) ?? prices[0];
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
  const confirmed = !details.loading && !details.error && !state.provisional;
  const starts = confirmed ? (state.entitlements?.startsAtUtc ?? subscription?.startsAtUtc) : null;
  const expires = confirmed
    ? (state.entitlements?.expiresAtUtc ?? subscription?.expiresAtUtc)
    : null;
  const localDate = (value: string) =>
    new Date(value).toLocaleDateString(language === 'fa' ? 'fa-IR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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
          {access.isAccount ? (
            <View className="gap-sm">
              <Text accessibilityLiveRegion="polite">{t('paywall.status', { status })}</Text>
              {starts && Number.isFinite(Date.parse(starts)) ? (
                <Text>{t('subscription.startDate', { date: localDate(starts) })}</Text>
              ) : null}
              {expires && Number.isFinite(Date.parse(expires)) ? (
                <Text>{t('subscription.endDate', { date: localDate(expires) })}</Text>
              ) : null}
              {state.provisional && active ? (
                <Text tone="warning">{t('access.provisional')}</Text>
              ) : null}
            </View>
          ) : null}
          <View className="gap-md">
            <PlanFeature icon={Layers} label={t('paywall.plusDecks')} />
            <PlanFeature icon={RectangleHorizontal} label={t('paywall.plusCards')} />
            <PlanFeature icon={BookOpen} label={t('paywall.study')} />
          </View>
        </Card>

        {!active ? (
          <Card variant="outlined" className="gap-md" style={{ backgroundColor: colors.surface }}>
            <Text variant="headingSmall" accessibilityRole="header">
              {t('paywall.choose')}
            </Text>
            {catalog.loading ? <LoadingState label={t('paywall.loading')} /> : null}
            {catalog.error ? (
              <FeedbackModal message={t('access.unavailable')} onRetry={catalog.refresh} />
            ) : null}
            {!catalog.loading && !catalog.error && !prices.length ? (
              <View className="gap-sm">
                <Text tone="secondary">{t('paywall.empty')}</Text>
                <Button
                  label={t('common.tryAgain')}
                  variant="secondary"
                  onPress={catalog.refresh}
                />
              </View>
            ) : null}
            {!catalog.loading && !catalog.error
              ? prices.map((price) => {
                  const total = t(
                    price.durationMonths === 1 ? 'paywall.monthPrice' : 'access.price',
                    {
                      months: number(price.durationMonths),
                      amount: amount(price.priceToman),
                    },
                  );
                  const monthly = t('paywall.perMonth', {
                    amount: amount(price.priceToman / price.durationMonths),
                  });
                  const discount = regularMonthlyPrice
                    ? Math.round(
                        (1 - price.priceToman / (regularMonthlyPrice * price.durationMonths)) * 100,
                      )
                    : 0;
                  const savings =
                    discount > 0 && discount < 100
                      ? ` · ${t('paywall.discount', { percent: number(discount) })}`
                      : '';
                  return (
                    <Button
                      key={price.durationMonths}
                      testID={`plus-plan-${price.durationMonths}`}
                      label={price.durationMonths === 1 ? total : `${total}\n${monthly}${savings}`}
                      variant={
                        selected?.durationMonths === price.durationMonths ? 'primary' : 'secondary'
                      }
                      accessibilityState={{
                        selected: selected?.durationMonths === price.durationMonths,
                      }}
                      onPress={() => setSelectedMonths(price.durationMonths)}
                    />
                  );
                })
              : null}
            {selected && !catalog.loading && !catalog.error ? (
              <Text variant="labelLarge" testID="selected-plan">
                {t(selected.durationMonths === 1 ? 'paywall.monthTotal' : 'paywall.total', {
                  months: number(selected.durationMonths),
                  amount: number(selected.priceToman),
                })}
              </Text>
            ) : null}
            {selected && selected.durationMonths > 1 && !catalog.loading && !catalog.error ? (
              <Text variant="bodySmall" tone="secondary" testID="selected-plan-monthly">
                {t('paywall.perMonth', {
                  amount: amount(selected.priceToman / selected.durationMonths),
                })}
              </Text>
            ) : null}
            <Button label={t('paywall.purchaseUnavailable')} disabled />
            <View className="gap-sm rounded-md bg-primarySoft p-md">
              <Text variant="bodySmall" tone="secondary">
                {t('paywall.providerMissing')}
              </Text>
            </View>
          </Card>
        ) : null}

        <Card
          variant="outlined"
          className="gap-md"
          style={{ backgroundColor: colors.surface }}
          testID="premium-plan"
        >
          <View
            className={`flex-wrap items-center justify-between gap-sm ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <Text variant="headingSmall" accessibilityRole="header" className="flex-shrink">
              {t('paywall.premiumPlan')}
            </Text>
            <Badge label={t('paywall.premiumStatus')} />
          </View>
          <Text tone="secondary">{t('access.premiumUnavailable')}</Text>
        </Card>

        {restriction ? (
          <FeedbackModal
            title={t('paywall.reason')}
            tone="warning"
            message={[
              restriction.operation === 'study' ? t('paywall.studyReason') : null,
              restriction.decks ? t('paywall.deckReason') : null,
              restriction.cards ? t('paywall.cardReason') : null,
            ]
              .filter(Boolean)
              .join('\n')}
          />
        ) : null}
        {subscription?.status === 'Expired' ? (
          <FeedbackModal message={t('paywall.expired')} tone="info" />
        ) : null}
        {details.loading ? <LoadingState label={t('subscription.loading')} /> : null}
        {details.error ? (
          <FeedbackModal message={t('paywall.statusError')} onRetry={details.refresh} />
        ) : null}
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
