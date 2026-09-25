import { View } from 'react-native';

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
  return (
    <Card className="gap-md">
      <Text variant="headingSmall" accessibilityRole="header">
        Current Leitner boxes
      </Text>
      <Text variant="bodySmall" tone="secondary">
        Active cards now, including cards you have not reviewed.
      </Text>
      {total ? (
        ([1, 2, 3, 4, 5] as const).map((box) => (
          <View
            key={box}
            className="flex-row justify-between gap-md"
            accessible
            accessibilityLabel={`Box ${box}: ${distribution[box]} active ${distribution[box] === 1 ? 'card' : 'cards'}`}
          >
            <Text>Box {box}</Text>
            <Text variant="labelLarge">{distribution[box]}</Text>
          </View>
        ))
      ) : (
        <Text tone="secondary">No active cards to distribute.</Text>
      )}
    </Card>
  );
}

export function AnalyticsScreen() {
  const analytics = useAnalyticsViewModel();
  const data = analytics.data;
  return (
    <Screen scroll edges={tabScreenEdges}>
      <View className="gap-xl pb-3xl">
        <ScreenHeader title="Analytics" description="Review history and current card progress." />
        <View className="gap-sm">
          <Text variant="labelLarge">Time window</Text>
          <View className="flex-row border-b border-border" accessibilityRole="tablist">
            {windows.map((days) => (
              <Tab
                key={days}
                label={`${days}D`}
                accessibilityHint={`Show the last ${days} calendar days of study activity`}
                active={analytics.window === days}
                onPress={() => analytics.setWindow(days)}
              />
            ))}
          </View>
        </View>
        {analytics.loading ? (
          <LoadingState label="Loading analytics" />
        ) : analytics.error ? (
          <Card className="gap-md" accessibilityLiveRegion="polite">
            <Text tone="error">{analytics.error}</Text>
            <Button label="Try again" onPress={analytics.refresh} />
          </Card>
        ) : data ? (
          <>
            {!data.hasHistory ? (
              <EmptyState
                title="No study data yet"
                description="Complete your first review to start tracking progress."
              />
            ) : data.totalReviews === 0 ? (
              <Text tone="secondary">
                No reviews in this window. Earlier study days still count toward your best streak.
              </Text>
            ) : null}
            <Card
              className="gap-xs"
              accessible
              accessibilityLabel={`Current streak: ${data.currentStreak} ${data.currentStreak === 1 ? 'day' : 'days'}. Best streak: ${data.bestStreak} ${data.bestStreak === 1 ? 'day' : 'days'}.`}
            >
              <Text variant="bodySmall" tone="secondary">
                Current streak
              </Text>
              <Text variant="headingLarge">
                {data.currentStreak} {data.currentStreak === 1 ? 'day' : 'days'}
              </Text>
              <Text variant="bodySmall" tone="secondary">
                Best: {data.bestStreak} {data.bestStreak === 1 ? 'day' : 'days'}
              </Text>
            </Card>
            <View className="flex-row gap-md">
              <Card
                className="min-w-0 flex-1 gap-sm"
                accessible
                accessibilityLabel={`Cards reviewed today: ${data.cardsReviewedToday}`}
              >
                <Text variant="bodySmall" tone="secondary">
                  Cards today
                </Text>
                <Text variant="headingMedium">{data.cardsReviewedToday}</Text>
              </Card>
              <Card
                className="min-w-0 flex-1 gap-sm"
                accessible
                accessibilityLabel={`Retention in the selected window: ${data.retentionRate === null ? 'No review data yet' : `${Math.round(data.retentionRate)} percent`}`}
              >
                <Text variant="bodySmall" tone="secondary">
                  Retention
                </Text>
                <Text variant="headingMedium">
                  {data.retentionRate === null ? '—' : `${Math.round(data.retentionRate)}%`}
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
              {data.totalReviews} reviews across {data.activeStudyDays} active{' '}
              {data.activeStudyDays === 1 ? 'day' : 'days'} in this window.
            </Text>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
