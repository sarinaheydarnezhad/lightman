import type { Deck } from './deck';

export interface DeckRepository {
  getById(id: string): Promise<Deck | null>;
  list(): Promise<Deck[]>;
  save(deck: Deck): Promise<void>;
}
