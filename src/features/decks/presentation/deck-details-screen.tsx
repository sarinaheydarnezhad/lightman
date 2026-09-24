import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { application } from '@/core/composition/application';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useDeckDetailsViewModel } from './use-decks-view-model';

export function DeckDetailsScreen({ deckId }: { deckId: string }) {
  const { data, loading, error, refresh } = useDeckDetailsViewModel(deckId);
  const [actionError, setActionError] = useState<string | null>(null);
  const deck = data?.deck;

  if (loading && !data)
    return (
      <FeaturePlaceholder title="Loading deck" description="Loading deck and cards…">
        <LoadingState label="Loading deck" />
      </FeaturePlaceholder>
    );

  if (!deck) {
    return (
      <FeaturePlaceholder
        title="Deck unavailable"
        description={error ?? "This deck isn't available."}
      >
        <Button label="Try again" onPress={refresh} />
        <Button label="Browse decks" onPress={() => router.replace('/decks')} />
      </FeaturePlaceholder>
    );
  }

  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-2xl">
        <ScreenHeader title={deck.name} description={deck.description} />
        <Card className="gap-sm">
          <Badge label={`${data.cards.length} cards`} />
          <Text tone="secondary">
            {deck.language} · {deck.textAlignment} · {deck.typographySize}
          </Text>
        </Card>
        {data.cards.map((card) => (
          <Card
            key={card.id}
            variant="interactive"
            accessibilityLabel={`Open ${card.frontText} card`}
            onPress={() =>
              router.push({
                pathname: '/decks/[deckId]/cards/[cardId]',
                params: { deckId, cardId: card.id },
              })
            }
          >
            <Text variant="headingSmall">{card.frontText}</Text>
            <Text tone="secondary">{card.meaning}</Text>
          </Card>
        ))}
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
        {actionError ? <Text tone="error">{actionError}</Text> : null}
        <Button
          label="Archive deck"
          variant="destructive"
          onPress={() => {
            void application
              .archiveDeck(deckId)
              .then(() => router.replace('/decks'))
              .catch(() => setActionError('Unable to archive this deck.'));
          }}
        />
      </View>
    </Screen>
  );
}
