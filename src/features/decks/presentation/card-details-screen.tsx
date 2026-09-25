import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { View } from 'react-native';

import { AppError } from '@/core/errors/app-error';
import { speech } from '@/core/composition/speech';
import { PronunciationButton } from '@/shared/speech/pronunciation-button';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { ConfirmationPanel } from '@/shared/ui/confirmation-panel';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
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
        <View
          className="gap-2xl"
          pointerEvents={confirmArchive ? 'none' : 'auto'}
          accessibilityElementsHidden={confirmArchive}
          importantForAccessibility={confirmArchive ? 'no-hide-descendants' : 'auto'}
        >
          <ScreenHeader title={data.card.frontText} description={`From ${data.deck.name}`} />
          <CardContent deck={data.deck} content={data.card} />
          <View
            style={{ alignItems: data.deck.textAlignment === 'rtl' ? 'flex-end' : 'flex-start' }}
          >
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
          <Button label="Archive card" variant="tertiary" onPress={() => setConfirmArchive(true)} />
        </View>
        {confirmArchive ? (
          <ConfirmationPanel
            title="Archive this card?"
            description="It will be removed from the active cards in this deck."
            cancelLabel="Keep card"
            confirmLabel="Confirm archive"
            busy={archiving}
            error={actionError}
            onCancel={() => {
              setConfirmArchive(false);
              setActionError(null);
            }}
            onConfirm={() => void archive()}
          />
        ) : null}
      </View>
    </Screen>
  );
}
