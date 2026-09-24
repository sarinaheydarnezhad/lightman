import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { AppError } from '@/core/errors/app-error';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { cardCountLabel, deckAlignment, deckTypography, languageLabel } from './deck-presentation';
import { useDeckActions, useDeckDetailsViewModel } from './use-decks-view-model';

export function DeckDetailsScreen({ deckId }: { deckId: string }) {
  const { data, loading, error, refresh } = useDeckDetailsViewModel(deckId);
  const actions = useDeckActions();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const deck = data?.deck;

  async function archive() {
    if (archiving) return;
    setArchiving(true);
    setActionError(null);
    try {
      await actions.archive(deckId);
      router.replace('/decks');
    } catch (cause) {
      setActionError(
        cause instanceof AppError ? cause.message : 'Unable to archive this deck. Try again.',
      );
      setArchiving(false);
    }
  }

  if (loading && !data)
    return (
      <FeaturePlaceholder title="Loading deck" description="Loading deck and cards…">
        <LoadingState label="Loading deck" />
      </FeaturePlaceholder>
    );

  if (!deck || error) {
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

  const contentStyle = {
    textAlign: deckAlignment[deck.textAlignment],
    writingDirection: deck.textAlignment === 'rtl' ? ('rtl' as const) : ('ltr' as const),
  };

  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-2xl pb-3xl">
        <ScreenHeader title={deck.name} description={deck.description} />
        <Card className="gap-md">
          <Badge label={cardCountLabel(data.cards.length)} />
          <Text variant="labelLarge">Deck settings</Text>
          <Text tone="secondary">
            {languageLabel(deck.language)} · {deck.textAlignment.toUpperCase()} ·{' '}
            {deck.typographySize}
          </Text>
          <Text tone="tertiary" variant="caption">
            Created {deck.createdAt.slice(0, 10)} · Updated {deck.updatedAt.slice(0, 10)}
          </Text>
        </Card>
        <Card className="gap-sm">
          <Text variant="labelLarge">Reading preview</Text>
          <Text variant={deckTypography[deck.typographySize]} style={contentStyle}>
            {deck.name}
          </Text>
        </Card>
        <View className="gap-md">
          <Text variant="headingMedium" accessibilityRole="header">
            Cards
          </Text>
          {data.cards.length === 0 ? (
            <Card className="gap-sm">
              <Text variant="headingSmall">No cards yet</Text>
              <Text tone="secondary">Add a card to start building this deck.</Text>
            </Card>
          ) : (
            data.cards.map((card) => (
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
                className="gap-sm"
              >
                <Text variant={deckTypography[deck.typographySize]} style={contentStyle}>
                  {card.frontText}
                </Text>
                <Text tone="secondary" style={contentStyle}>
                  {card.meaning}
                </Text>
              </Card>
            ))
          )}
        </View>
        <View className="gap-sm">
          <Button label="Start study" onPress={() => router.push('/study')} />
          <Button
            label="Add card"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/decks/[deckId]/cards/create', params: { deckId } })
            }
          />
          <Button
            label="Edit deck"
            variant="secondary"
            onPress={() => router.push({ pathname: '/decks/[deckId]/edit', params: { deckId } })}
          />
        </View>
        {confirmArchive ? (
          <Card className="gap-md" accessibilityLiveRegion="polite">
            <Text variant="headingSmall">Archive this deck?</Text>
            <Text tone="secondary">It will be removed from your active deck list.</Text>
            {actionError ? (
              <Text tone="error" accessibilityLiveRegion="polite">
                {actionError}
              </Text>
            ) : null}
            <Button
              label="Keep deck"
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
          <Button label="Archive deck" variant="tertiary" onPress={() => setConfirmArchive(true)} />
        )}
      </View>
    </Screen>
  );
}
