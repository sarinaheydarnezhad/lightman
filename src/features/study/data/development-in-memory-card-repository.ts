import type { Card } from '../domain/card';
import type { CardRepository } from '../domain/card-repository';

/** Temporary session-only adapter. */
export class DevelopmentInMemoryCardRepository implements CardRepository {
  private readonly cards = new Map<string, Card>();

  async getById(id: string): Promise<Card | null> {
    const card = this.cards.get(id);
    return card ? { ...card } : null;
  }

  async listByDeck(deckId: string): Promise<Card[]> {
    return Array.from(this.cards.values())
      .filter((card) => card.deckId === deckId)
      .map((card) => ({ ...card }));
  }

  async save(card: Card): Promise<void> {
    this.cards.set(card.id, { ...card });
  }
}
