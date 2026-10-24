import { useCallback, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import {
  Check,
  Crown,
  Layers,
  RectangleHorizontal,
  Shield,
  type LucideIcon,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { syncEngine } from '@/core/composition/sync';
import { learningAccess } from '@/core/composition/learning-access';
import { freeLearningLimits } from '@/core/access/learning-access';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import { FeedbackModal } from '@/shared/ui/feedback-modal';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { icons, spacing } from '@/shared/theme/tokens';

function SubscriptionDetail({
  icon: Icon,
  label,
  accent = false,
}: {
  icon: LucideIcon;
  label: string;
  accent?: boolean;
}) {
  const { direction } = useLocalization();
  const colors = useThemeColors();
  return (
    <View className={`items-start gap-sm ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="shrink-0"
      >
        <Icon size={icons.medium} color={accent ? colors.primary : colors.secondaryText} />
      </View>
      <Text variant="bodySmall" className="min-w-0 flex-1">
        {label}
      </Text>
    </View>
  );
}

export function SettingsSubscriptionCard() {
  const { t, language, number, direction } = useLocalization();
  const colors = useThemeColors();
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
    <Card
      variant="outlined"
      className="gap-lg"
      style={{ backgroundColor: colors.surface, padding: spacing.lg }}
      testID="settings-subscription-card"
    >
      <View className="gap-md">
        <View
          className={`items-center gap-sm ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="shrink-0"
          >
            <Shield size={icons.medium} color={colors.primary} />
          </View>
          <Text variant="labelLarge" className="min-w-0 flex-1" accessibilityRole="header">
            {t('settings.subscription.title')}
          </Text>
        </View>
        <View className="gap-xs">
          {entitlements ? (
            <Text
              variant="headingMedium"
              tone={entitlements.isActive ? 'accent' : 'primary'}
              accessibilityLabel={t('access.current', {
                plan: t(entitlements.isActive ? 'paywall.plusPlan' : 'account.freePlan'),
              })}
            >
              {t(entitlements.isActive ? 'paywall.plusPlan' : 'account.freePlan')}
            </Text>
          ) : null}
          <View
            accessible={metadata.loading}
            accessibilityRole={metadata.loading ? 'progressbar' : undefined}
            accessibilityLabel={metadata.loading ? t('access.refresh') : undefined}
            accessibilityState={{ busy: metadata.loading }}
          >
            <Text
              variant="caption"
              tone={expired ? 'warning' : 'secondary'}
              accessibilityLiveRegion="polite"
            >
              {t('paywall.status', { status })}
            </Text>
          </View>
        </View>
        {entitlements ? (
          <View className="gap-sm">
            {!entitlements.isActive ? (
              <>
                <SubscriptionDetail
                  icon={Layers}
                  label={t('paywall.freeDecks', { count: number(freeLearningLimits.decks) })}
                />
                <SubscriptionDetail
                  icon={RectangleHorizontal}
                  label={t('paywall.freeCards', { count: number(freeLearningLimits.cards) })}
                />
                <Text
                  variant="caption"
                  tone={entitlements.withinFreeTierLimits ? 'secondary' : 'warning'}
                >
                  {t(
                    entitlements.withinFreeTierLimits
                      ? 'settings.subscription.freeAccess'
                      : 'access.restricted',
                  )}
                </Text>
              </>
            ) : null}
            {entitlements.startsAtUtc ? (
              <Text variant="caption" tone="secondary">
                {t('account.starts', { time: localTime(entitlements.startsAtUtc) })}
              </Text>
            ) : null}
            {entitlements.expiresAtUtc ? (
              <Text variant="caption" tone="secondary">
                {t('access.expires', { time: localTime(entitlements.expiresAtUtc) })}
              </Text>
            ) : null}
            {expired ? (
              <Text variant="bodySmall" tone="warning">
                {t('paywall.expired')}
              </Text>
            ) : null}
            {entitlements.isActive ? (
              <Text variant="caption" tone="secondary">
                {t('account.activePurchaseBlocked')}
              </Text>
            ) : null}
          </View>
        ) : null}
        {!metadata.loading && !confirmed ? (
          <FeedbackModal message={t('account.subscriptionUnknown')} tone="warning" onRetry={metadata.refresh} retryLabel={t('access.refresh')} />
        ) : null}
      </View>

      <View
        className="gap-md rounded-md p-lg"
        style={{ backgroundColor: colors.primarySoft }}
        testID="settings-subscription-benefits"
      >
        <View
          className={`items-start gap-sm ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="shrink-0"
          >
            <Crown size={icons.medium} color={colors.primary} />
          </View>
          <View className="min-w-0 flex-1 gap-xs">
            <Text variant="labelLarge" tone="accent" accessibilityRole="header">
              {t('paywall.plusPlan')}
            </Text>
            <Text variant="bodySmall" tone="secondary">
              {t('settings.subscription.plusSubtitle')}
            </Text>
          </View>
        </View>
        <View className="gap-sm">
          <SubscriptionDetail icon={Check} label={t('settings.subscription.unlimited')} accent />
          <SubscriptionDetail icon={Check} label={t('settings.subscription.study')} accent />
        </View>
        <View className="gap-xs border-t border-border pt-md">
          <Text variant="caption" weight="medium" tone="secondary">
            {t('settings.subscription.purchaseUnavailable')}
          </Text>
          <Text variant="caption" tone="secondary">
            {t('settings.subscription.purchaseNotice')}
          </Text>
        </View>
      </View>

      <View className="gap-sm border-t border-border pt-lg">
        <Button
          label={t('settings.upgradePlus')}
          onPress={() => router.push('/settings/subscription' as import('expo-router').Href)}
        />
        {metadata.loading || confirmed ? <Button
          label={t('access.refresh')}
          variant="secondary"
          loading={metadata.loading}
          onPress={metadata.refresh}
        /> : null}
      </View>
    </Card>
  );
}
