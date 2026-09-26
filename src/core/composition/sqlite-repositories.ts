import type { Database } from '@/core/database/database';
import { SQLiteCardRepository } from '@/features/study/data/sqlite-card-repository';
import { SQLiteReviewRepository } from '@/features/study/data/sqlite-review-repository';
import { SQLiteStudySessionRepository } from '@/features/study/data/sqlite-study-session-repository';
import { SQLiteSettingsRepository } from '@/features/settings/data/sqlite-settings-repository';
import { SQLiteDeckRepository } from '@/features/decks/data/sqlite-deck-repository';
import type { Repositories } from '@/core/ports/repositories';

export function createSqliteRepositories(database: Database): Repositories {
  return {
    decks: new SQLiteDeckRepository(database),
    cards: new SQLiteCardRepository(database),
    reviews: new SQLiteReviewRepository(database),
    sessions: new SQLiteStudySessionRepository(database),
    settings: new SQLiteSettingsRepository(database),
  };
}
