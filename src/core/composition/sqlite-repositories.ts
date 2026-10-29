import type { Database } from '@/core/database/database';
import { SQLiteCardRepository } from '@/features/study/data/sqlite-card-repository';
import { SQLiteReviewRepository } from '@/features/study/data/sqlite-review-repository';
import { SQLiteStudySessionRepository } from '@/features/study/data/sqlite-study-session-repository';
import { SQLiteStudyAnswerRepository } from '@/features/study/data/sqlite-study-answer-repository';
import { SQLiteSettingsRepository } from '@/features/settings/data/sqlite-settings-repository';
import { SQLiteDeckRepository } from '@/features/decks/data/sqlite-deck-repository';
import type { Repositories } from '@/core/ports/repositories';
import {
  DeviceLanguageSettingsRepository,
  type DeviceLanguagePreference,
} from '@/features/settings/data/device-language-settings-repository';

export function createSqliteRepositories(
  database: Database,
  deviceLanguage?: DeviceLanguagePreference,
): Repositories {
  const cards = new SQLiteCardRepository(database);
  const settings = new SQLiteSettingsRepository(database);
  return {
    decks: new SQLiteDeckRepository(database),
    cards,
    reviews: new SQLiteReviewRepository(database),
    sessions: new SQLiteStudySessionRepository(database),
    settings: deviceLanguage
      ? new DeviceLanguageSettingsRepository(settings, deviceLanguage)
      : settings,
    cardCreation: cards,
    studyAnswers: new SQLiteStudyAnswerRepository(database),
  };
}
