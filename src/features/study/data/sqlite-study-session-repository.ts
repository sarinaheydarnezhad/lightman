import { instant, requiredId } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import type { Database, DatabaseTransaction } from '@/core/database/database';
import {
  databaseOperation,
  integer,
  json,
  nullableText,
  row,
  text,
  transactionOperation,
} from '@/core/database/sqlite-repository-utils';
import { validateStudySession, type StudySession } from '../domain/study-session';
import type { StudySessionRepository } from '../domain/study-session-repository';

function mapSession(source: ReturnType<typeof row>): StudySession | null {
  if (!source) return null;
  return validateStudySession({
    id: text(source, 'id'),
    scope: json<StudySession['scope']>(source, 'scope_json'),
    status: text(source, 'status') as StudySession['status'],
    startedAt: nullableText(source, 'started_at')
      ? instant(nullableText(source, 'started_at')!)
      : null,
    completedAt: nullableText(source, 'completed_at')
      ? instant(nullableText(source, 'completed_at')!)
      : null,
    cancelledAt: nullableText(source, 'cancelled_at')
      ? instant(nullableText(source, 'cancelled_at')!)
      : null,
    initialQueue: json<StudySession['initialQueue']>(source, 'initial_queue_json'),
    retryQueue: json<StudySession['retryQueue']>(source, 'retry_queue_json'),
    currentIndex: integer(source, 'current_index'),
    retrySuccesses: integer(source, 'retry_successes'),
  });
}

function writeSession(
  database: Database | DatabaseTransaction,
  session: StudySession,
): Promise<unknown> {
  return database.execute(
    `INSERT INTO study_sessions (id, scope_json, status, started_at, completed_at, cancelled_at, initial_queue_json, retry_queue_json, current_index, retry_successes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET scope_json = excluded.scope_json, status = excluded.status, started_at = excluded.started_at,
       completed_at = excluded.completed_at, cancelled_at = excluded.cancelled_at,
       initial_queue_json = excluded.initial_queue_json, retry_queue_json = excluded.retry_queue_json,
       current_index = excluded.current_index, retry_successes = excluded.retry_successes`,
    [
      session.id,
      JSON.stringify(session.scope),
      session.status,
      session.startedAt,
      session.completedAt,
      session.cancelledAt,
      JSON.stringify(session.initialQueue),
      JSON.stringify(session.retryQueue),
      session.currentIndex,
      session.retrySuccesses,
    ],
  );
}

export class SQLiteStudySessionRepository implements StudySessionRepository {
  constructor(private readonly database: Database) {}

  create(session: StudySession): Promise<StudySession> {
    return databaseOperation(async () => {
      const valid = validateStudySession(session);
      const existing = await this.database.execute('SELECT id FROM study_sessions WHERE id = ?', [
        valid.id,
      ]);
      if (existing.rows.length) throw new AppError('conflict', 'Study session already exists.');
      if (valid.status === 'in-progress' && (await this.getActive()))
        throw new AppError('conflict', 'Finish or cancel your current study session first.');
      await writeSession(this.database, valid);
      return validateStudySession(valid);
    }, 'Unable to save the study session.');
  }

  getById(id: string): Promise<StudySession | null> {
    return databaseOperation(async () => {
      requiredId(id, 'Study session ID');
      const result = await this.database.execute('SELECT * FROM study_sessions WHERE id = ?', [id]);
      return mapSession(row(result));
    }, 'Unable to load the study session.');
  }

  getActive(): Promise<StudySession | null> {
    return databaseOperation(async () => {
      const result = await this.database.execute(
        `SELECT * FROM study_sessions WHERE status = 'in-progress' ORDER BY started_at DESC, id LIMIT 1`,
      );
      return mapSession(row(result));
    }, 'Unable to load the active study session.');
  }

  update(session: StudySession, expectedCurrentIndex: number): Promise<StudySession> {
    return transactionOperation(
      this.database,
      async (transaction) => {
        const valid = validateStudySession(session);
        const previousResult = await transaction.execute(
          'SELECT * FROM study_sessions WHERE id = ?',
          [valid.id],
        );
        const previous = mapSession(row(previousResult));
        if (!previous) throw new AppError('not-found', 'Study session not found.');
        if (previous.status !== 'in-progress' || valid.status === 'not-started')
          throw new AppError('conflict', 'Study session is not active.');
        if (
          previous.currentIndex !== expectedCurrentIndex ||
          valid.currentIndex < previous.currentIndex
        )
          throw new AppError('conflict', 'Study session changed during this answer.');
        if (
          previous.startedAt !== valid.startedAt ||
          JSON.stringify(previous.scope) !== JSON.stringify(valid.scope) ||
          JSON.stringify(previous.initialQueue) !== JSON.stringify(valid.initialQueue)
        )
          throw new AppError('conflict', 'Study session history cannot be changed.');
        if (
          valid.retryQueue.length < previous.retryQueue.length ||
          previous.retryQueue.some(
            (item, index) => JSON.stringify(item) !== JSON.stringify(valid.retryQueue[index]),
          )
        )
          throw new AppError('conflict', 'Study retry history cannot be changed.');
        const result = await transaction.execute(
          `UPDATE study_sessions SET scope_json = ?, status = ?, started_at = ?, completed_at = ?, cancelled_at = ?, initial_queue_json = ?, retry_queue_json = ?, current_index = ?, retry_successes = ?
           WHERE id = ? AND status = 'in-progress' AND current_index = ?`,
          [
            JSON.stringify(valid.scope),
            valid.status,
            valid.startedAt,
            valid.completedAt,
            valid.cancelledAt,
            JSON.stringify(valid.initialQueue),
            JSON.stringify(valid.retryQueue),
            valid.currentIndex,
            valid.retrySuccesses,
            valid.id,
            expectedCurrentIndex,
          ],
        );
        if (result.rowsAffected !== 1)
          throw new AppError('conflict', 'Study session changed during the update.');
        return validateStudySession(valid);
      },
      'Unable to save the study session.',
    );
  }
}
