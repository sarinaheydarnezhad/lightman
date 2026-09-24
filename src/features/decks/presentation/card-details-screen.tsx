import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { application } from '@/core/composition/application';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useCardDetailsViewModel } from './use-decks-view-model';

export function CardDetailsScreen({ deckId, cardId }: { deckId: string; cardId: string }) {
  const { data, loading, error, refresh } = useCardDetailsViewModel(cardId);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading && !data)
    return (
      <FeaturePlaceholder title="Loading card" description="Loading card details…">
        <LoadingState label="Loading card" />
      </FeaturePlaceholder>
    );
  if (!data || data.card.deckId !== deckId) {
    return (
      <FeaturePlaceholder
        title="Card unavailable"
        description={error ?? "This card isn't available."}
      >
        <Button label="Try again" onPress={refresh} />
      </FeaturePlaceholder>
    );
  }

  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-xl">
        <ScreenHeader title={data.card.frontText} description={`From ${data.deck.name}`} />
        <Text variant="headingSmall">{data.card.meaning}</Text>
        {data.card.phonetic ? <Text tone="secondary">{data.card.phonetic}</Text> : null}
        {data.card.category ? <Text tone="secondary">{data.card.category}</Text> : null}
        {data.card.examples.map((example, index) => (
          <Card key={`${index}-${example.sentence}`}>
            <Text>{example.sentence}</Text>
            {example.translation ? <Text tone="secondary">{example.translation}</Text> : null}
          </Card>
        ))}
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
        {actionError ? <Text tone="error">{actionError}</Text> : null}
        <Button
          label="Archive card"
          variant="destructive"
          onPress={() => {
            void application
              .archiveCard(cardId)
              .then(() => router.replace({ pathname: '/decks/[deckId]', params: { deckId } }))
              .catch(() => setActionError('Unable to archive this card.'));
          }}
        />
      </View>
    </Screen>
  );
}
