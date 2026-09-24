import type { Deck } from './deck';

export interface DeckRepository {
  getById(id: string): Promise<Deck | null>;
  list(options?: { search?: string; includeArchived?: boolean }): Promise<Deck[]>;
  create(deck: Deck): Promise<Deck>;
  update(deck: Deck): Promise<Deck>;
  archive(id: string, archivedAt: Deck['archivedAt']): Promise<Deck>;
}
