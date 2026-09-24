import { router } from 'expo-router';
import { View } from 'react-native';

import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useStartStudy, openStudySession } from './use-start-study';

export function StudyScreen() {
  const study = useStartStudy();

  return (
    <Screen scroll edges={tabScreenEdges}>
      <View className="gap-2xl">
        <ScreenHeader title="Study" description="A focused session with the cards due today." />
        <Card className="gap-lg">
          <Badge label="All your decks" />
          <Text variant="headingMedium" accessibilityRole="header">
            Ready to study?
          </Text>
          <Text tone="secondary">
            Reveal each answer, then choose Success or Failure. Missed cards get one more try at the
            end.
          </Text>
          <Button
            label="Start study"
            loading={study.starting}
            onPress={() => void study.start({ kind: 'all-decks' })}
          />
        </Card>
        {study.error ? (
          <Card className="gap-md" accessibilityLiveRegion="polite">
            <Text tone="error">{study.error}</Text>
            {study.activeSession ? (
              <Button
                label="Resume session"
                variant="secondary"
                onPress={() => openStudySession(study.activeSession!)}
              />
            ) : null}
          </Card>
        ) : null}
        <Button label="Browse decks" variant="tertiary" onPress={() => router.push('/decks')} />
      </View>
    </Screen>
  );
}
