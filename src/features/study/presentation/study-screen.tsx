import { router } from 'expo-router';
import { View } from 'react-native';

import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useStudyViewModel } from './use-study-view-model';

export function StudyScreen() {
  const study = useStudyViewModel();

  return (
    <Screen scroll edges={tabScreenEdges}>
      <View className="gap-2xl">
        <ScreenHeader title="Study" description="Make room for a few focused minutes." />
        {study.phase === 'empty' ? (
          <EmptyState title={study.title} description={study.description} />
        ) : (
          <Card className="gap-md">
            <Badge label={study.phase === 'complete' ? 'Session preview' : 'Ready to study'} />
            <Text variant="headingMedium" accessibilityRole="header">
              {study.title}
            </Text>
            <Text tone="secondary">{study.description}</Text>
          </Card>
        )}
        <Button
          label={study.action}
          onPress={() => {
            if (study.phase === 'ready') {
              router.push({ pathname: '/study/[sessionId]', params: { sessionId: 'preview' } });
            } else {
              router.push('/decks');
            }
          }}
        />
      </View>
    </Screen>
  );
}
