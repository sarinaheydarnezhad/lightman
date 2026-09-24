import type { Card } from './card';

export interface CardRepository {
  getById(id: string): Promise<Card | null>;
  listByDeck(
    deckId: string,
    options?: { search?: string; includeArchived?: boolean },
  ): Promise<Card[]>;
  create(card: Card): Promise<Card>;
  update(card: Card): Promise<Card>;
  archive(id: string, archivedAt: Card['archivedAt']): Promise<Card>;
}
