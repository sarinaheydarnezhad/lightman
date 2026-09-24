import { router } from 'expo-router';
import { View } from 'react-native';

import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { getDemoDeck } from './use-decks-view-model';

export function DeckDetailsScreen({ deckId }: { deckId: string }) {
  const deck = getDemoDeck(deckId);

  if (!deck) {
    return (
      <FeaturePlaceholder title="Deck unavailable" description="This sample deck isn't available.">
        <Button label="Browse decks" onPress={() => router.replace('/decks')} />
      </FeaturePlaceholder>
    );
  }

  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-2xl">
        <ScreenHeader title={deck.title} description={deck.description} />
        <Card className="gap-sm">
          <Badge label={`${deck.cardCount} sample cards`} />
          <Text tone="secondary">
            This deck is a navigation preview. Card content will arrive later.
          </Text>
        </Card>
        <Button
          label="Create card"
          onPress={() =>
            router.push({ pathname: '/decks/[deckId]/cards/create', params: { deckId } })
          }
        />
        <Button
          label="Edit deck"
          variant="secondary"
          onPress={() => router.push({ pathname: '/decks/[deckId]/edit', params: { deckId } })}
        />
        <Button
          label="Preview card details"
          variant="tertiary"
          onPress={() =>
            router.push({
              pathname: '/decks/[deckId]/cards/[cardId]',
              params: { deckId, cardId: 'preview-card' },
            })
          }
        />
      </View>
    </Screen>
  );
}
