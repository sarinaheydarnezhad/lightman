import { useCallback } from 'react';
import { application } from '@/core/composition/application';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';
import { sortDecks, type DeckSort } from './deck-presentation';

/** Screen commands are routed through the feature boundary; only composition binds adapters. */
export function useDeckActions() {
  return {
    get: application.getDeck,
    create: application.createDeck,
    update: application.updateDeck,
    archive: application.archiveDeck,
  };
}

export function useDecksViewModel(search = '', sort: DeckSort = 'recently-updated') {
  const resource = useFocusedResource(
    useCallback(async () => {
      const [decks, all] = await Promise.all([
        application.listDecks({ search }),
        application.listDecks(),
      ]);
      return {
        decks: sortDecks(
          await Promise.all(
            decks.map(async (deck) => ({
              ...deck,
              cardCount: await application.countActiveCardsForDeck(deck.id),
            })),
          ),
          sort,
        ),
        totalCount: all.length,
      };
    }, [search, sort]),
  );
  return {
    ...resource,
    decks: resource.data?.decks ?? [],
    totalCount: resource.data?.totalCount ?? 0,
  };
}

export function useDeckDetailsViewModel(deckId: string) {
  return useFocusedResource(
    useCallback(
      async () => ({
        deck: await application.getDeck(deckId),
        cardCount: await application.countActiveCardsForDeck(deckId),
      }),
      [deckId],
    ),
  );
}
