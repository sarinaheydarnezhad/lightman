import { router } from 'expo-router';
import { View } from 'react-native';

import { layout } from '@/shared/theme/tokens';
import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useHomeViewModel } from './use-home-view-model';

export function HomeScreen() {
  const home = useHomeViewModel();
  const metrics = [
    { label: 'Cards due', value: home.cardsDue },
    { label: 'Reviewed today', value: home.reviewedToday },
    { label: 'Current streak', value: home.currentStreak },
  ];

  return (
    <Screen scroll edges={tabScreenEdges}>
      <View className="gap-2xl">
        <View className="gap-lg">
          <ScreenHeader title="Welcome back" description={home.greeting} />
          <Badge label="Sample values" />
        </View>

        <View className="gap-md">
          <Text variant="headingMedium" accessibilityRole="header">
            Today’s study
          </Text>
          <View className="flex-row flex-wrap gap-sm">
            {metrics.map((metric) => (
              <Card
                key={metric.label}
                className="flex-1 gap-sm"
                style={{ minWidth: layout.metricMinWidth }}
              >
                <Text tone="secondary" variant="bodySmall">
                  {metric.label}
                </Text>
                <Text variant="headingMedium">{metric.value}</Text>
              </Card>
            ))}
          </View>
          <Button label="Start study" onPress={() => router.push('/study')} />
        </View>

        <View className="gap-md">
          <Text variant="headingMedium" accessibilityRole="header">
            Continue studying
          </Text>
          {home.recentDecks.map((deck) => (
            <Card
              key={deck.id}
              variant="interactive"
              accessibilityLabel={`Open ${deck.title} deck`}
              onPress={() =>
                router.push({ pathname: '/decks/[deckId]', params: { deckId: deck.id } })
              }
              className="gap-sm"
            >
              <Text variant="headingSmall">{deck.title}</Text>
              <Text tone="secondary">{deck.description}</Text>
              <Text tone="tertiary" variant="caption">
                {deck.activityLabel}
              </Text>
            </Card>
          ))}
          <Button
            label="Browse all decks"
            variant="tertiary"
            onPress={() => router.push('/decks')}
          />
        </View>
      </View>
    </Screen>
  );
}
