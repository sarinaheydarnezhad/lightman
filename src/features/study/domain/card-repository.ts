import type { Card } from './card';

export interface CardRepository {
  getById(id: string): Promise<Card | null>;
  listByDeck(deckId: string): Promise<Card[]>;
  save(card: Card): Promise<void>;
}
