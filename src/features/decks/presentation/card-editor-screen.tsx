import { router } from 'expo-router';

import type { CreateCardInput } from '@/core/application/create-application';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { CardForm } from './card-form';
import { useCardActions, useCardEditorViewModel } from './use-cards-view-model';

export function CardEditorScreen({ deckId, cardId }: { deckId: string; cardId?: string }) {
  const { create, update } = useCardActions();
  const resource = useCardEditorViewModel(deckId, cardId);

  async function save(content: Omit<CreateCardInput, 'deckId'>) {
    if (cardId) {
      await update(cardId, content);
      router.dismissTo({
        pathname: '/decks/[deckId]/cards/[cardId]',
        params: { deckId, cardId },
      });
    } else {
      const card = await create({ ...content, deckId });
      router.replace({
        pathname: '/decks/[deckId]/cards/[cardId]',
        params: { deckId, cardId: card.id },
      });
    }
  }

  if (resource.loading && !resource.data)
    return (
      <Screen edges={stackScreenEdges}>
        <LoadingState label="Loading card editor" />
      </Screen>
    );
  if (!resource.data || resource.error)
    return (
      <Screen edges={stackScreenEdges}>
        <EmptyState
          title="Card unavailable"
          description={resource.error ?? "This card isn't available."}
        />
        <Button label="Try again" onPress={resource.refresh} />
        <Button label="Browse decks" variant="tertiary" onPress={() => router.replace('/decks')} />
      </Screen>
    );
  return (
    <CardForm
      key={cardId ?? deckId}
      deck={resource.data.deck}
      existing={resource.data.card ?? undefined}
      onSubmit={save}
    />
  );
}
