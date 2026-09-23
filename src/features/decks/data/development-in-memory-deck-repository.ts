import type { Deck } from '../domain/deck';
import type { DeckRepository } from '../domain/deck-repository';

/** Temporary session-only adapter; replace at composition root when persistence arrives. */
export class DevelopmentInMemoryDeckRepository implements DeckRepository {
  private readonly decks = new Map<string, Deck>();

  async getById(id: string): Promise<Deck | null> {
    const deck = this.decks.get(id);
    return deck ? { ...deck } : null;
  }

  async list(): Promise<Deck[]> {
    return Array.from(this.decks.values(), (deck) => ({ ...deck }));
  }

  async save(deck: Deck): Promise<void> {
    this.decks.set(deck.id, { ...deck });
  }
}
