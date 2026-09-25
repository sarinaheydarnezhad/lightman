import { useWindowDimensions, View } from 'react-native';
import { useLocalization } from '@/shared/localization/localization-provider';

import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Tab } from '@/shared/ui/tab';
import { Text } from '@/shared/ui/text';
import type { AnalyticsWindow, BoxDistribution } from '../domain/analytics';
import { ActivityChart } from './activity-chart';
import { useAnalyticsViewModel } from './use-analytics-view-model';

const windows: AnalyticsWindow[] = [7, 30, 90];

function BoxSummary({ distribution, total }: { distribution: BoxDistribution; total: number }) {
  const { t, number } = useLocalization();
  return (
    <Card className="gap-md">
      <Text variant="headingSmall" accessibilityRole="header">
        {t('analytics.boxes')}
      </Text>
      <Text variant="bodySmall" tone="secondary">
        {t('analytics.boxesHint')}
      </Text>
      {total ? (
        ([1, 2, 3, 4, 5] as const).map((box) => (
          <View
            key={box}
            className="flex-row justify-between gap-md"
            accessible
            accessibilityLabel={t('analytics.boxA11y', {
              box: number(box),
              count: number(distribution[box]),
              unit: t(distribution[box] === 1 ? 'analytics.cardUnit' : 'analytics.cardsUnit'),
            })}
          >
            <Text>{t('analytics.box', { box: number(box) })}</Text>
            <Text variant="labelLarge">{number(distribution[box])}</Text>
          </View>
        ))
      ) : (
        <Text tone="secondary">{t('analytics.boxEmpty')}</Text>
      )}
    </Card>
  );
}

export function AnalyticsScreen() {
  const { t, number, language } = useLocalization();
  const { fontScale, width } = useWindowDimensions();
  const stackMetrics = fontScale >= 1.4 || width < 360;
  const analytics = useAnalyticsViewModel();
  const data = analytics.data;
  return (
    <Screen scroll edges={tabScreenEdges}>
      <View className="gap-xl pb-3xl">
        <ScreenHeader title={t('nav.analytics')} description={t('analytics.description')} />
        <View className="gap-sm">
          <Text variant="labelLarge">{t('analytics.window')}</Text>
          <View className="flex-row border-b border-border" accessibilityRole="tablist">
            {windows.map((days) => (
              <Tab
                key={days}
                label={`${number(days)}D`}
                accessibilityHint={t('analytics.windowHint', { days: number(days) })}
                active={analytics.window === days}
                onPress={() => analytics.setWindow(days)}
              />
            ))}
          </View>
        </View>
        {analytics.loading ? (
          <LoadingState label={t('analytics.loading')} />
        ) : analytics.error ? (
          <Card className="gap-md" accessibilityLiveRegion="polite">
            <Text tone="error">
              {language === 'en' ? analytics.error : t('common.genericError')}
            </Text>
            <Button label={t('common.tryAgain')} onPress={analytics.refresh} />
          </Card>
        ) : data ? (
          <>
            {!data.hasHistory ? (
              <EmptyState
                title={t('analytics.noHistory')}
                description={t('analytics.noHistoryHint')}
              />
            ) : data.totalReviews === 0 ? (
              <Text tone="secondary">{t('analytics.noReviews')}</Text>
            ) : null}
            <Card
              className="gap-xs"
              accessible
              accessibilityLabel={t('analytics.streakA11y', {
                current: t(data.currentStreak === 1 ? 'common.day' : 'common.days', {
                  count: number(data.currentStreak),
                }),
                best: t(data.bestStreak === 1 ? 'common.day' : 'common.days', {
                  count: number(data.bestStreak),
                }),
              })}
            >
              <Text variant="bodySmall" tone="secondary">
                {t('analytics.currentStreak')}
              </Text>
              <Text variant="headingLarge">
                {t(data.currentStreak === 1 ? 'common.day' : 'common.days', {
                  count: number(data.currentStreak),
                })}
              </Text>
              <Text variant="bodySmall" tone="secondary">
                {t('analytics.best', {
                  count: t(data.bestStreak === 1 ? 'common.day' : 'common.days', {
                    count: number(data.bestStreak),
                  }),
                })}
              </Text>
            </Card>
            <View className={stackMetrics ? 'gap-md' : 'flex-row gap-md'}>
              <Card
                className={stackMetrics ? 'w-full gap-sm' : 'min-w-0 flex-1 gap-sm'}
                accessible
                accessibilityLabel={t('analytics.cardsTodayA11y', {
                  count: number(data.cardsReviewedToday),
                })}
              >
                <Text variant="bodySmall" tone="secondary">
                  {t('analytics.cardsToday')}
                </Text>
                <Text variant="headingMedium">{number(data.cardsReviewedToday)}</Text>
              </Card>
              <Card
                className={stackMetrics ? 'w-full gap-sm' : 'min-w-0 flex-1 gap-sm'}
                accessible
                accessibilityLabel={t('analytics.retentionA11y', {
                  value:
                    data.retentionRate === null
                      ? t('analytics.noReviewData')
                      : t('analytics.percent', { value: number(Math.round(data.retentionRate)) }),
                })}
              >
                <Text variant="bodySmall" tone="secondary">
                  {t('analytics.retention')}
                </Text>
                <Text variant="headingMedium">
                  {data.retentionRate === null ? '—' : `${number(Math.round(data.retentionRate))}%`}
                </Text>
              </Card>
            </View>
            <ActivityChart
              activity={data.dailyActivity}
              window={analytics.window}
              totalReviews={data.totalReviews}
              activeDays={data.activeStudyDays}
            />
            <BoxSummary distribution={data.boxDistribution} total={data.activeCardCount} />
            <Text tone="secondary" variant="bodySmall">
              {t('analytics.summary', {
                reviews: number(data.totalReviews),
                days: number(data.activeStudyDays),
              })}
            </Text>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
