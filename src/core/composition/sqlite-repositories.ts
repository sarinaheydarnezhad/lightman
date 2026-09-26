import type { Database } from '@/core/database/database';
import { SQLiteCardRepository } from '@/features/study/data/sqlite-card-repository';
import { SQLiteReviewRepository } from '@/features/study/data/sqlite-review-repository';
import { SQLiteStudySessionRepository } from '@/features/study/data/sqlite-study-session-repository';
import { SQLiteSettingsRepository } from '@/features/settings/data/sqlite-settings-repository';
import { SQLiteDeckRepository } from '@/features/decks/data/sqlite-deck-repository';
import type { Repositories } from '@/core/ports/repositories';

export function createSqliteRepositories(database: Database): Repositories {
  const cards = new SQLiteCardRepository(database);
  return {
    decks: new SQLiteDeckRepository(database),
    cards,
    reviews: new SQLiteReviewRepository(database),
    sessions: new SQLiteStudySessionRepository(database),
    settings: new SQLiteSettingsRepository(database),
    cardCreation: cards,
  };
}
