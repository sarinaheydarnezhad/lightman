import { View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { useThemeColors } from '@/shared/theme/theme-provider';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import type { DailyReviewActivity } from '../domain/analytics';

/** Fixed coordinate space scales to its parent; at most 90 aggregate bars are rendered. */
export function chartBarHeights(activity: readonly DailyReviewActivity[], height = 60): number[] {
  const peak = Math.max(0, ...activity.map((day) => day.reviewCount));
  return activity.map((day) =>
    day.reviewCount && peak ? Math.max(2, (day.reviewCount / peak) * height) : 0,
  );
}

export function ActivityChart({
  activity,
  window,
  totalReviews,
  activeDays,
}: {
  activity: readonly DailyReviewActivity[];
  window: number;
  totalReviews: number;
  activeDays: number;
}) {
  const colors = useThemeColors();
  const summary = `${window}-day review activity: ${totalReviews} ${totalReviews === 1 ? 'review' : 'reviews'} across ${activeDays} active ${activeDays === 1 ? 'day' : 'days'}.`;
  const heights = chartBarHeights(activity);
  const width = 360;
  const baseline = 72;
  const step = width / Math.max(1, activity.length);
  return (
    <Card className="gap-md">
      <Text variant="headingSmall" accessibilityRole="header">
        Daily activity
      </Text>
      <View accessible accessibilityRole="image" accessibilityLabel={summary}>
        <Svg width="100%" height={80} viewBox="0 0 360 80" accessible={false}>
          <Line
            x1={0}
            y1={baseline}
            x2={width}
            y2={baseline}
            stroke={colors.border}
            strokeWidth={1}
          />
          {heights.map((height, index) =>
            height > 0 ? (
              <Rect
                key={activity[index]!.date}
                x={index * step + step * 0.2}
                y={baseline - height}
                width={step * 0.6}
                height={height}
                rx={Math.min(2, step * 0.15)}
                fill={colors.primary}
              />
            ) : null,
          )}
        </Svg>
      </View>
      <View className="flex-row justify-between gap-md" style={{ direction: 'ltr' }}>
        <Text variant="caption" tone="secondary" style={{ writingDirection: 'ltr' }}>
          {activity[0]?.date}
        </Text>
        <Text variant="caption" tone="secondary" style={{ writingDirection: 'ltr' }}>
          {activity.at(-1)?.date}
        </Text>
      </View>
      <Text tone="secondary" variant="bodySmall" accessibilityLiveRegion="polite">
        {summary}
      </Text>
    </Card>
  );
}
