import { InMemoryDeckRepository } from '@/features/decks/data/development-in-memory-deck-repository';
import { InMemorySettingsRepository } from '@/features/settings/data/development-in-memory-settings-repository';
import { InMemoryCardRepository } from '@/features/study/data/development-in-memory-card-repository';
import { InMemoryReviewRepository } from '@/features/study/data/development-in-memory-review-repository';
import { InMemoryStudySessionRepository } from '@/features/study/data/development-in-memory-study-session-repository';
import type { Repositories } from '@/core/ports/repositories';
import { OpSqliteDatabase } from '@/core/database/op-sqlite-database';
import { createSqliteRepositories } from './sqlite-repositories';

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
export const database = testEnvironment ? null : new OpSqliteDatabase();

/** The sole binding site for replaceable application infrastructure. */
export const repositories: Repositories = database
  ? createSqliteRepositories(database)
  : inMemoryRepositories();

export async function initializeRepositories(): Promise<void> {
  if (database) await database.initialize();
}
