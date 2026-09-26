import { useCallback } from 'react';

import { application } from '@/core/composition/application';
import { AppError } from '@/core/errors/app-error';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';
import { sortCards, type CardSort } from './card-presentation';

export function useCardActions() {
  return {
    getDeck: application.getDeck,
    getCard: application.getCard,
    create: application.createCard,
    update: application.updateCard,
    archive: application.archiveCard,
  };
}

export function useCardListViewModel(
  deckId: string,
  search: string,
  category: string | null,
  sort: CardSort = 'recently-updated',
) {
  const resource = useFocusedResource(
    useCallback(async () => {
      const snapshot = await application.getCardListSnapshot(deckId, {
        search: search.trim() || undefined,
        category: category ?? undefined,
      });
      return {
        deck: snapshot.deck,
        cards: sortCards(snapshot.cards, sort),
        categories: snapshot.categories,
        totalCount: snapshot.totalCount,
      };
    }, [deckId, search, category, sort]),
  );
  return {
    ...resource,
    cards: resource.data?.cards ?? [],
    categories: resource.data?.categories ?? [],
    totalCount: resource.data?.totalCount ?? 0,
  };
}

export function useCardDetailsViewModel(cardId: string, deckId: string) {
  return useFocusedResource(
    useCallback(async () => {
      const card = await application.getCard(cardId);
      if (card.deckId !== deckId) throw new AppError('not-found', 'Card not found.');
      return { card, deck: await application.getDeck(deckId) };
    }, [cardId, deckId]),
  );
}

export function useCardEditorViewModel(deckId: string, cardId?: string) {
  return useFocusedResource(
    useCallback(async () => {
      const deck = await application.getDeck(deckId);
      if (!cardId) return { deck, card: null };
      const card = await application.getCard(cardId);
      if (card.deckId !== deckId) throw new AppError('not-found', 'Card not found.');
      return { deck, card };
    }, [deckId, cardId]),
  );
}
