import { instant } from '@/core/domain/values';
import { makeDeck } from '@/../test/fixtures';
import type { Database, DatabaseTransaction, SqlResult, SqlValue } from '@/core/database/database';
import { SQLiteDeckRepository } from './sqlite-deck-repository';

class ScriptedDatabase implements Database {
  constructor(private readonly responses: SqlResult[]) {}

  async execute(_sql: string, _params?: readonly SqlValue[]): Promise<SqlResult> {
    return this.responses.shift() ?? { rows: [], rowsAffected: 1 };
  }

  async transaction(operation: (transaction: DatabaseTransaction) => Promise<void>): Promise<void> {
    await operation({ execute: (sql, params) => this.execute(sql, params) });
  }
}

function deckRow(deck = makeDeck()) {
  return {
    id: deck.id,
    name: deck.name,
    description: deck.description,
    language: deck.language,
    text_alignment: deck.textAlignment,
    typography_size: deck.typographySize,
    created_at: deck.createdAt,
    updated_at: deck.updatedAt,
    archived_at: deck.archivedAt,
  };
}

test('SQLite deck repository maps CRUD rows and preserves domain rules', async () => {
  const deck = makeDeck();
  const edited = makeDeck({ name: 'Edited', updatedAt: instant('2026-09-24T11:00:00.000Z') });
  const archived = makeDeck({
    updatedAt: instant('2026-09-24T12:00:00.000Z'),
    archivedAt: instant('2026-09-24T12:00:00.000Z'),
  });
  const database = new ScriptedDatabase([
    { rows: [], rowsAffected: 1 },
    { rows: [deckRow(deck)], rowsAffected: 1 },
    { rows: [deckRow(deck)], rowsAffected: 1 },
    { rows: [], rowsAffected: 1 },
    { rows: [deckRow(deck)], rowsAffected: 1 },
    { rows: [], rowsAffected: 1 },
  ]);
  const repository = new SQLiteDeckRepository(database);

  await expect(repository.create(deck)).resolves.toEqual(deck);
  await expect(repository.getById(deck.id)).resolves.toEqual(deck);
  await expect(repository.update(edited)).resolves.toEqual(edited);
  await expect(repository.archive(deck.id, archived.archivedAt)).resolves.toEqual(archived);
  await expect(repository.getById('')).rejects.toMatchObject({ code: 'validation' });
});

test('SQLite deck repository reports missing updates as not found', async () => {
  const database = new ScriptedDatabase([{ rows: [], rowsAffected: 0 }]);
  const repository = new SQLiteDeckRepository(database);

  await expect(repository.update(makeDeck())).rejects.toMatchObject({ code: 'not-found' });
});
