import { router } from 'expo-router';
import { View } from 'react-native';

import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { getDemoDeck } from './use-decks-view-model';

export function CardDetailsScreen({ deckId, cardId }: { deckId: string; cardId: string }) {
  const deck = getDemoDeck(deckId);

  if (!deck || cardId !== 'preview-card') {
    return (
      <FeaturePlaceholder
        title="Card unavailable"
        description="This sample card isn't available."
      />
    );
  }

  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-xl">
        <ScreenHeader title="Card details" description={`A future card from ${deck.title}.`} />
        <Text tone="secondary">Card content will appear here when cards are available.</Text>
        <Button
          label="Edit card"
          onPress={() =>
            router.push({
              pathname: '/decks/[deckId]/cards/[cardId]/edit',
              params: { deckId, cardId },
            })
          }
        />
        <Button
          label="Vocabulary helper"
          variant="secondary"
          onPress={() => router.push('/vocabulary/helper')}
        />
      </View>
    </Screen>
  );
}
