import { instant, requiredId } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import type { Database } from '@/core/database/database';
import {
  databaseOperation,
  integer,
  nullableText,
  normalizeSearch,
  row,
  text,
  json,
} from '@/core/database/sqlite-repository-utils';
import { validateCard, type Card } from '../domain/card';
import type { CardRepository } from '../domain/card-repository';

function mapCard(source: ReturnType<typeof row>): Card | null {
  if (!source) return null;
  return validateCard({
    id: text(source, 'id'),
    deckId: text(source, 'deck_id'),
    frontText: text(source, 'front_text'),
    phonetic: nullableText(source, 'phonetic'),
    category: nullableText(source, 'category'),
    meaning: text(source, 'meaning'),
    examples: json<Card['examples']>(source, 'examples_json'),
    createdAt: instant(text(source, 'created_at')),
    updatedAt: instant(text(source, 'updated_at')),
    archivedAt: nullableText(source, 'archived_at')
      ? instant(nullableText(source, 'archived_at')!)
      : null,
  });
}

export class SQLiteCardRepository implements CardRepository {
  constructor(private readonly database: Database) {}

  getById(id: string): Promise<Card | null> {
    return databaseOperation(async () => {
      requiredId(id, 'Card ID');
      const result = await this.database.execute('SELECT * FROM cards WHERE id = ?', [id]);
      return mapCard(row(result));
    }, 'Unable to load cards.');
  }

  listByDeck(
    deckId: string,
    options: { search?: string; category?: string; includeArchived?: boolean } = {},
  ): Promise<Card[]> {
    return databaseOperation(async () => {
      requiredId(deckId, 'Deck ID');
      const conditions = ['deck_id = ?'];
      const params: (string | number | null)[] = [deckId];
      if (!options.includeArchived) conditions.push('archived_at IS NULL');
      if (options.category?.trim()) {
        conditions.push('LOWER(TRIM(category)) = ?');
        params.push(normalizeSearch(options.category));
      }
      if (options.search?.trim()) {
        conditions.push(
          `LOWER(front_text || ' ' || COALESCE(phonetic, '') || ' ' || COALESCE(category, '') || ' ' || meaning) LIKE ?`,
        );
        params.push(`%${normalizeSearch(options.search)}%`);
      }
      const result = await this.database.execute(
        `SELECT * FROM cards WHERE ${conditions.join(' AND ')} ORDER BY front_text COLLATE NOCASE, id`,
        params,
      );
      return result.rows
        .map((source) => mapCard(source))
        .filter((card): card is Card => card !== null);
    }, 'Unable to load cards.');
  }

  async countByDeck(deckId: string): Promise<number> {
    return databaseOperation(async () => {
      requiredId(deckId, 'Deck ID');
      const result = await this.database.execute(
        'SELECT COUNT(*) AS count FROM cards WHERE deck_id = ? AND archived_at IS NULL',
        [deckId],
      );
      return integer(row(result) ?? {}, 'count');
    }, 'Unable to count cards.');
  }

  listCategoriesByDeck(deckId: string): Promise<string[]> {
    return databaseOperation(async () => {
      requiredId(deckId, 'Deck ID');
      const result = await this.database.execute(
        'SELECT category FROM cards WHERE deck_id = ? AND archived_at IS NULL AND category IS NOT NULL',
        [deckId],
      );
      const categories = new Map<string, string>();
      for (const source of result.rows) {
        const category = nullableText(source, 'category');
        if (category) {
          const key = normalizeSearch(category);
          if (!categories.has(key)) categories.set(key, category);
        }
      }
      return [...categories.values()].sort((left, right) => left.localeCompare(right));
    }, 'Unable to load card categories.');
  }

  create(card: Card): Promise<Card> {
    return databaseOperation(async () => {
      const valid = validateCard(card);
      if (valid.archivedAt !== null)
        throw new AppError('validation', 'Cannot create an archived card.');
      await this.insert(valid);
      return valid;
    }, 'Unable to save the card.');
  }

  update(card: Card): Promise<Card> {
    return databaseOperation(async () => {
      const valid = validateCard(card);
      const existing = await this.getById(valid.id);
      if (!existing) throw new AppError('not-found', 'Card not found.');
      if (existing.archivedAt) throw new AppError('conflict', 'Archived cards cannot be edited.');
      if (
        existing.deckId !== valid.deckId ||
        existing.createdAt !== valid.createdAt ||
        valid.archivedAt !== null ||
        valid.updatedAt < existing.updatedAt
      )
        throw new AppError('conflict', 'Card history cannot be changed.');
      const result = await this.database.execute(
        `UPDATE cards SET front_text = ?, phonetic = ?, category = ?, meaning = ?, examples_json = ?, updated_at = ?
           WHERE id = ? AND archived_at IS NULL`,
        [
          valid.frontText,
          valid.phonetic,
          valid.category,
          valid.meaning,
          JSON.stringify(valid.examples),
          valid.updatedAt,
          valid.id,
        ],
      );
      if (result.rowsAffected !== 1)
        throw new AppError('conflict', 'Card changed during the edit.');
      return valid;
    }, 'Unable to save the card.');
  }

  archive(id: string, archivedAt: Card['archivedAt']): Promise<Card> {
    return databaseOperation(async () => {
      requiredId(id, 'Card ID');
      if (archivedAt === null) throw new AppError('validation', 'Archive date is required.');
      instant(archivedAt);
      const existing = await this.getById(id);
      if (!existing) throw new AppError('not-found', 'Card not found.');
      if (existing.archivedAt) throw new AppError('conflict', 'Card is already archived.');
      if (archivedAt < existing.updatedAt)
        throw new AppError('conflict', 'Archive date is older than the last edit.');
      const archived = validateCard({ ...existing, updatedAt: archivedAt, archivedAt });
      const result = await this.database.execute(
        'UPDATE cards SET updated_at = ?, archived_at = ? WHERE id = ? AND archived_at IS NULL',
        [archived.updatedAt, archived.archivedAt, id],
      );
      if (result.rowsAffected !== 1)
        throw new AppError('conflict', 'Card changed during archiving.');
      return archived;
    }, 'Unable to archive the card.');
  }

  private insert(card: Card): Promise<unknown> {
    return this.database.execute(
      `INSERT INTO cards (id, deck_id, front_text, phonetic, category, meaning, examples_json, created_at, updated_at, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        card.id,
        card.deckId,
        card.frontText,
        card.phonetic,
        card.category,
        card.meaning,
        JSON.stringify(card.examples),
        card.createdAt,
        card.updatedAt,
        card.archivedAt,
      ],
    );
  }
}
