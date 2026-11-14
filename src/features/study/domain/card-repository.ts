import type { Card } from './card';

export interface CardRepository {
  /** Read-only diagnostics; original rows and their learning history remain in storage. */
  listIntegrityIssues?(deckId: string): Promise<{ cardId: string; message: string }[]>;
  getById(id: string): Promise<Card | null>;
  listByDeck(
    deckId: string,
    options?: { search?: string; category?: string; includeArchived?: boolean },
  ): Promise<Card[]>;
  countByDeck(deckId: string): Promise<number>;
  listCategoriesByDeck(deckId: string): Promise<string[]>;
  create(card: Card): Promise<Card>;
  update(card: Card): Promise<Card>;
  archive(id: string, archivedAt: Card['archivedAt']): Promise<Card>;
}
