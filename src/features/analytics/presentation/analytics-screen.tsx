import { View } from 'react-native';
import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { Badge } from '@/shared/ui/badge';
import { Card } from '@/shared/ui/card';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useAnalyticsViewModel } from './use-analytics-view-model';

export function AnalyticsScreen() {
  const analytics = useAnalyticsViewModel();

  return (
    <Screen scroll edges={tabScreenEdges}>
      <View className="gap-2xl">
        <ScreenHeader title="Analytics" description="Your progress will take shape as you study." />
        <Badge label="Awaiting study history" />

        <View className="flex-row gap-sm">
          <Card className="flex-1 gap-sm">
            <Text tone="secondary" variant="bodySmall">
              Retention
            </Text>
            <Text variant="headingMedium">{analytics.retention}</Text>
          </Card>
          <Card className="flex-1 gap-sm">
            <Text tone="secondary" variant="bodySmall">
              Cards reviewed
            </Text>
            <Text variant="headingMedium">{analytics.reviewed}</Text>
          </Card>
        </View>

        <View className="gap-md">
          <Card className="gap-sm">
            <Text variant="headingSmall" accessibilityRole="header">
              Streak history
            </Text>
            <Text tone="secondary">{analytics.streakHistory}</Text>
          </Card>
          <Card className="gap-sm">
            <Text variant="headingSmall" accessibilityRole="header">
              Leitner boxes
            </Text>
            <Text tone="secondary">{analytics.boxDistribution}</Text>
          </Card>
          <Card className="gap-sm">
            <Text variant="headingSmall" accessibilityRole="header">
              Historical activity
            </Text>
            <Text tone="secondary">{analytics.activity}</Text>
          </Card>
        </View>
      </View>
    </Screen>
  );
}
