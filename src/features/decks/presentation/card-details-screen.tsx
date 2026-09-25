import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { View } from 'react-native';

import { AppError } from '@/core/errors/app-error';
import { speech } from '@/core/composition/speech';
import { PronunciationButton } from '@/shared/speech/pronunciation-button';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { CardContent } from './card-content';
import { useCardActions, useCardDetailsViewModel } from './use-cards-view-model';

export function CardDetailsScreen({ deckId, cardId }: { deckId: string; cardId: string }) {
  useFocusEffect(useCallback(() => () => void speech.stop(), []));
  const { data, loading, error, refresh } = useCardDetailsViewModel(cardId, deckId);
  const { archive: archiveCard } = useCardActions();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const submitting = useRef(false);

  async function archive() {
    if (submitting.current) return;
    submitting.current = true;
    setArchiving(true);
    setActionError(null);
    try {
      await archiveCard(cardId);
      router.dismissTo({ pathname: '/decks/[deckId]/cards', params: { deckId } });
    } catch (cause) {
      setActionError(
        cause instanceof AppError ? cause.message : 'Unable to archive this card. Try again.',
      );
      submitting.current = false;
      setArchiving(false);
    }
  }

  if (loading && !data)
    return (
      <FeaturePlaceholder title="Loading card" description="Loading card details…">
        <LoadingState label="Loading card" />
      </FeaturePlaceholder>
    );
  if (!data || error)
    return (
      <FeaturePlaceholder
        title="Card unavailable"
        description={error ?? "This card isn't available."}
      >
        <Button label="Try again" onPress={refresh} />
        <Button
          label="View cards"
          variant="secondary"
          onPress={() =>
            router.replace({
              pathname: '/decks/[deckId]/cards',
              params: { deckId },
            })
          }
        />
      </FeaturePlaceholder>
    );

  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-2xl pb-3xl">
        <ScreenHeader title={data.card.frontText} description={`From ${data.deck.name}`} />
        <CardContent deck={data.deck} content={data.card} />
        <View style={{ alignItems: data.deck.textAlignment === 'rtl' ? 'flex-end' : 'flex-start' }}>
          <PronunciationButton text={data.card.frontText} language={data.deck.language} />
        </View>
        <Button
          label="Edit card"
          onPress={() =>
            router.push({
              pathname: '/decks/[deckId]/cards/[cardId]/edit',
              params: { deckId, cardId },
            })
          }
        />
        {confirmArchive ? (
          <Card className="gap-md" accessibilityLiveRegion="polite">
            <Text variant="headingSmall">Archive this card?</Text>
            <Text tone="secondary">It will be removed from the active cards in this deck.</Text>
            {actionError ? (
              <Text tone="error" accessibilityLiveRegion="polite">
                {actionError}
              </Text>
            ) : null}
            <Button
              label="Keep card"
              variant="secondary"
              disabled={archiving}
              onPress={() => {
                setConfirmArchive(false);
                setActionError(null);
              }}
            />
            <Button
              label="Confirm archive"
              variant="destructive"
              loading={archiving}
              onPress={() => void archive()}
            />
          </Card>
        ) : (
          <Button label="Archive card" variant="tertiary" onPress={() => setConfirmArchive(true)} />
        )}
      </View>
    </Screen>
  );
}
