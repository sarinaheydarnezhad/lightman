import { instant, requiredId } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import { validateCard, type Card } from '../domain/card';
import type { CardRepository } from '../domain/card-repository';

/** Temporary session-only adapter. */
export class InMemoryCardRepository implements CardRepository {
  private readonly cards = new Map<string, Card>();

  async getById(id: string): Promise<Card | null> {
    const card = this.cards.get(id);
    return card ? { ...card, examples: card.examples.map((example) => ({ ...example })) } : null;
  }

  async listByDeck(
    deckId: string,
    options: { search?: string; includeArchived?: boolean } = {},
  ): Promise<Card[]> {
    requiredId(deckId, 'Deck ID');
    const search = options.search?.trim().toLocaleLowerCase();
    return Array.from(this.cards.values())
      .filter(
        (card) =>
          card.deckId === deckId &&
          (options.includeArchived || !card.archivedAt) &&
          (!search ||
            `${card.frontText} ${card.meaning} ${card.category ?? ''}`
              .toLocaleLowerCase()
              .includes(search)),
      )
      .map((card) => ({ ...card, examples: card.examples.map((example) => ({ ...example })) }));
  }

  async create(card: Card): Promise<Card> {
    const valid = validateCard(card);
    if (this.cards.has(valid.id)) throw new AppError('conflict', 'Card already exists.');
    if (valid.archivedAt !== null)
      throw new AppError('validation', 'Cannot create an archived card.');
    const copy = { ...valid, examples: valid.examples.map((example) => ({ ...example })) };
    this.cards.set(copy.id, copy);
    return { ...copy, examples: copy.examples.map((example) => ({ ...example })) };
  }

  async update(card: Card): Promise<Card> {
    const valid = validateCard(card);
    const existing = this.cards.get(valid.id);
    if (!existing) throw new AppError('not-found', 'Card not found.');
    if (existing.archivedAt) throw new AppError('conflict', 'Archived cards cannot be edited.');
    if (
      existing.deckId !== valid.deckId ||
      existing.createdAt !== valid.createdAt ||
      valid.archivedAt !== null ||
      valid.updatedAt < existing.updatedAt
    ) {
      throw new AppError('conflict', 'Card history cannot be changed.');
    }
    const copy = { ...valid, examples: valid.examples.map((example) => ({ ...example })) };
    this.cards.set(copy.id, copy);
    return { ...copy, examples: copy.examples.map((example) => ({ ...example })) };
  }

  async archive(id: string, archivedAt: Card['archivedAt']): Promise<Card> {
    requiredId(id, 'Card ID');
    if (archivedAt === null) throw new AppError('validation', 'Archive date is required.');
    instant(archivedAt);
    const card = this.cards.get(id);
    if (!card) throw new AppError('not-found', 'Card not found.');
    if (card.archivedAt) throw new AppError('conflict', 'Card is already archived.');
    if (archivedAt < card.updatedAt)
      throw new AppError('conflict', 'Archive date is older than the last edit.');
    const archived = validateCard({ ...card, updatedAt: archivedAt, archivedAt });
    this.cards.set(id, archived);
    return { ...archived, examples: archived.examples.map((example) => ({ ...example })) };
  }
}
