import { InMemoryDeckRepository } from '@/features/decks/data/development-in-memory-deck-repository';
import { InMemorySettingsRepository } from '@/features/settings/data/development-in-memory-settings-repository';
import { InMemoryCardRepository } from '@/features/study/data/development-in-memory-card-repository';
import { InMemoryReviewRepository } from '@/features/study/data/development-in-memory-review-repository';
import { InMemoryStudySessionRepository } from '@/features/study/data/development-in-memory-study-session-repository';
import type { Repositories } from '@/core/ports/repositories';
import { OpSqliteDatabase } from '@/core/database/op-sqlite-database';
import { createSqliteRepositories } from './sqlite-repositories';
import { LocalStorageScopes } from '@/core/storage/local-storage-scopes';
import { installFreeTierGuards } from '@/core/database/free-tier-guards';
import type { Database } from '@/core/database/database';
import { defaultSettings } from './default-settings';

function inMemoryRepositories(): Repositories {
  return {
    decks: new InMemoryDeckRepository(),
    cards: new InMemoryCardRepository(),
    reviews: new InMemoryReviewRepository(),
    sessions: new InMemoryStudySessionRepository(),
    settings: new InMemorySettingsRepository(),
  };
}

const testEnvironment = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
export const storageScopes = new LocalStorageScopes<Repositories>(
  async (name) => {
    const scopedDatabase = new OpSqliteDatabase(name);
    await scopedDatabase.initialize();
    await installFreeTierGuards(scopedDatabase);
    const value = createSqliteRepositories(scopedDatabase);
    if (!(await value.settings.get())) await value.settings.update(defaultSettings());
    return { database: scopedDatabase, value };
  },
  testEnvironment ? { database: null, value: inMemoryRepositories() } : undefined,
);

export const database: Database | null = testEnvironment
  ? null
  : {
      execute: (sql, params) => storageScopes.current().database!.execute(sql, params),
      transaction: (operation) => storageScopes.current().database!.transaction(operation),
    };

/** The sole binding site for replaceable application infrastructure. */
export const repositories: Repositories = new Proxy({} as Repositories, {
  get: (_target, property) => Reflect.get(storageScopes.current().value, property),
});

export async function initializeRepositories(): Promise<void> {
  await storageScopes.initialize();
}
