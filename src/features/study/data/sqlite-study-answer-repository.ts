import type { Database } from '@/core/database/database';
import { transactionOperation } from '@/core/database/sqlite-repository-utils';
import type { AtomicStudyAnswerRepository } from '@/core/ports/repositories';
import type { CardReviewState, ReviewEvent } from '../domain/review';
import type { StudySession } from '../domain/study-session';
import { SQLiteReviewRepository } from './sqlite-review-repository';
import { SQLiteStudySessionRepository } from './sqlite-study-session-repository';

export class SQLiteStudyAnswerRepository implements AtomicStudyAnswerRepository {
  constructor(private readonly database: Database) {}

  recordAnswer(
    event: ReviewEvent,
    state: CardReviewState,
    session: StudySession,
    expectedCurrentIndex: number,
  ): Promise<StudySession> {
    return transactionOperation(
      this.database,
      async (transaction) => {
        const scopedDatabase: Database = {
          execute: (sql, params) => transaction.execute(sql, params),
          transaction: (operation) => operation(transaction),
        };
        const saved = await new SQLiteStudySessionRepository(scopedDatabase).update(
          session,
          expectedCurrentIndex,
        );
        await new SQLiteReviewRepository(scopedDatabase).record(event, state);
        return saved;
      },
      'Unable to save the study answer.',
    );
  }
}
