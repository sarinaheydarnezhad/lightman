import { instant, requiredId } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import { validateDeck, type Deck } from '../domain/deck';
import type { DeckRepository } from '../domain/deck-repository';

/** Temporary session-only adapter; replace at composition root when persistence arrives. */
export class InMemoryDeckRepository implements DeckRepository {
  private readonly decks = new Map<string, Deck>();

  async getById(id: string): Promise<Deck | null> {
    const deck = this.decks.get(id);
    return deck ? { ...deck } : null;
  }

  async list(options: { search?: string; includeArchived?: boolean } = {}): Promise<Deck[]> {
    const search = options.search?.trim().toLocaleLowerCase();
    return Array.from(this.decks.values())
      .filter(
        (deck) =>
          (options.includeArchived || !deck.archivedAt) &&
          (!search || deck.name.toLocaleLowerCase().includes(search)),
      )
      .map((deck) => ({ ...deck }));
  }

  async create(deck: Deck): Promise<Deck> {
    const valid = validateDeck(deck);
    if (this.decks.has(valid.id)) throw new AppError('conflict', 'Deck already exists.');
    if (valid.archivedAt !== null)
      throw new AppError('validation', 'Cannot create an archived deck.');
    this.decks.set(valid.id, { ...valid });
    return { ...valid };
  }

  async update(deck: Deck): Promise<Deck> {
    const valid = validateDeck(deck);
    const existing = this.decks.get(valid.id);
    if (!existing) throw new AppError('not-found', 'Deck not found.');
    if (existing.archivedAt) throw new AppError('conflict', 'Archived decks cannot be edited.');
    if (
      valid.createdAt !== existing.createdAt ||
      valid.archivedAt !== null ||
      valid.updatedAt < existing.updatedAt
    ) {
      throw new AppError('conflict', 'Deck history cannot be changed.');
    }
    this.decks.set(valid.id, { ...valid });
    return { ...valid };
  }

  async archive(id: string, archivedAt: Deck['archivedAt']): Promise<Deck> {
    requiredId(id, 'Deck ID');
    if (archivedAt === null) throw new AppError('validation', 'Archive date is required.');
    instant(archivedAt);
    const deck = this.decks.get(id);
    if (!deck) throw new AppError('not-found', 'Deck not found.');
    if (deck.archivedAt) throw new AppError('conflict', 'Deck is already archived.');
    if (archivedAt < deck.updatedAt)
      throw new AppError('conflict', 'Archive date is older than the last edit.');
    const archived = validateDeck({ ...deck, updatedAt: archivedAt, archivedAt });
    this.decks.set(id, archived);
    return { ...archived };
  }
}
