import { DEMO_DECKS } from '@/shared/demo/decks';

export function useDecksViewModel(search = '') {
  const query = search.trim().toLocaleLowerCase();
  const decks = query
    ? DEMO_DECKS.filter((deck) => deck.title.toLocaleLowerCase().includes(query))
    : DEMO_DECKS;

  return { decks, totalCount: DEMO_DECKS.length };
}

export function getDemoDeck(deckId: string) {
  return DEMO_DECKS.find((deck) => deck.id === deckId);
}
