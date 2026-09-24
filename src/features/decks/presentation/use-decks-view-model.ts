import { useCallback } from 'react';
import { application } from '@/core/composition/application';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';

export function useDecksViewModel(search = '') {
  const resource = useFocusedResource(
    useCallback(async () => {
      const [decks, all] = await Promise.all([
        application.listDecks({ search }),
        application.listDecks(),
      ]);
      return {
        decks: await Promise.all(
          decks.map(async (deck) => ({
            ...deck,
            title: deck.name,
            cardCount: (await application.listCardsForDeck(deck.id)).length,
          })),
        ),
        totalCount: all.length,
      };
    }, [search]),
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
        cards: await application.listCardsForDeck(deckId),
      }),
      [deckId],
    ),
  );
}

export function useCardDetailsViewModel(cardId: string) {
  return useFocusedResource(
    useCallback(async () => {
      const card = await application.getCard(cardId);
      return { card, deck: await application.getDeck(card.deckId) };
    }, [cardId]),
  );
}
