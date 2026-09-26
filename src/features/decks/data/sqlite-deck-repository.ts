import { instant, requiredId } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import type { Database } from '@/core/database/database';
import {
  databaseOperation,
  nullableText,
  normalizeSearch,
  row,
  text,
} from '@/core/database/sqlite-repository-utils';
import { validateDeck, type Deck } from '../domain/deck';
import type { DeckRepository } from '../domain/deck-repository';

function mapDeck(source: ReturnType<typeof row>): Deck | null {
  if (!source) return null;
  return validateDeck({
    id: text(source, 'id'),
    name: text(source, 'name'),
    description: text(source, 'description'),
    language: text(source, 'language') as Deck['language'],
    textAlignment: text(source, 'text_alignment') as Deck['textAlignment'],
    typographySize: text(source, 'typography_size') as Deck['typographySize'],
    createdAt: instant(text(source, 'created_at')),
    updatedAt: instant(text(source, 'updated_at')),
    archivedAt: nullableText(source, 'archived_at')
      ? instant(nullableText(source, 'archived_at')!)
      : null,
  });
}

export class SQLiteDeckRepository implements DeckRepository {
  constructor(private readonly database: Database) {}

  getById(id: string): Promise<Deck | null> {
    return databaseOperation(async () => {
      requiredId(id, 'Deck ID');
      const result = await this.database.execute('SELECT * FROM decks WHERE id = ?', [id]);
      return mapDeck(row(result));
    }, 'Unable to load decks.');
  }

  list(options: { search?: string; includeArchived?: boolean } = {}): Promise<Deck[]> {
    return databaseOperation(async () => {
      const conditions: string[] = [];
      const params: string[] = [];
      if (!options.includeArchived) conditions.push('archived_at IS NULL');
      if (options.search?.trim()) {
        conditions.push('LOWER(name) LIKE ?');
        params.push(`%${normalizeSearch(options.search)}%`);
      }
      const result = await this.database.execute(
        `SELECT * FROM decks${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''} ORDER BY name COLLATE NOCASE, id`,
        params,
      );
      return result.rows
        .map((source) => mapDeck(source))
        .filter((deck): deck is Deck => deck !== null);
    }, 'Unable to load decks.');
  }

  create(deck: Deck): Promise<Deck> {
    return databaseOperation(async () => {
      const valid = validateDeck(deck);
      if (valid.archivedAt !== null)
        throw new AppError('validation', 'Cannot create an archived deck.');
      await this.database.execute(
        `INSERT INTO decks (id, name, description, language, text_alignment, typography_size, created_at, updated_at, archived_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          valid.id,
          valid.name,
          valid.description,
          valid.language,
          valid.textAlignment,
          valid.typographySize,
          valid.createdAt,
          valid.updatedAt,
          valid.archivedAt,
        ],
      );
      return valid;
    }, 'Unable to save the deck.');
  }

  update(deck: Deck): Promise<Deck> {
    return databaseOperation(async () => {
      const valid = validateDeck(deck);
      const existing = await this.getById(valid.id);
      if (!existing) throw new AppError('not-found', 'Deck not found.');
      if (existing.archivedAt) throw new AppError('conflict', 'Archived decks cannot be edited.');
      if (
        valid.createdAt !== existing.createdAt ||
        valid.archivedAt !== null ||
        valid.updatedAt < existing.updatedAt
      )
        throw new AppError('conflict', 'Deck history cannot be changed.');
      const result = await this.database.execute(
        `UPDATE decks SET name = ?, description = ?, language = ?, text_alignment = ?, typography_size = ?, updated_at = ?
           WHERE id = ? AND archived_at IS NULL`,
        [
          valid.name,
          valid.description,
          valid.language,
          valid.textAlignment,
          valid.typographySize,
          valid.updatedAt,
          valid.id,
        ],
      );
      if (result.rowsAffected !== 1)
        throw new AppError('conflict', 'Deck changed during the edit.');
      return valid;
    }, 'Unable to save the deck.');
  }

  archive(id: string, archivedAt: Deck['archivedAt']): Promise<Deck> {
    return databaseOperation(async () => {
      requiredId(id, 'Deck ID');
      if (archivedAt === null) throw new AppError('validation', 'Archive date is required.');
      instant(archivedAt);
      const existing = await this.getById(id);
      if (!existing) throw new AppError('not-found', 'Deck not found.');
      if (existing.archivedAt) throw new AppError('conflict', 'Deck is already archived.');
      if (archivedAt < existing.updatedAt)
        throw new AppError('conflict', 'Archive date is older than the last edit.');
      const archived = validateDeck({ ...existing, updatedAt: archivedAt, archivedAt });
      const result = await this.database.execute(
        'UPDATE decks SET updated_at = ?, archived_at = ? WHERE id = ? AND archived_at IS NULL',
        [archived.updatedAt, archived.archivedAt, id],
      );
      if (result.rowsAffected !== 1)
        throw new AppError('conflict', 'Deck changed during archiving.');
      return archived;
    }, 'Unable to archive the deck.');
  }
}
