import { AppError } from '@/core/errors/app-error';
import type { Database, DatabaseTransaction } from '@/core/database/database';
import {
  databaseOperation,
  integer,
  nullableText,
  row,
  text,
  transactionOperation,
} from '@/core/database/sqlite-repository-utils';
import {
  calendarDate,
  instant,
  requiredId,
  type CalendarDate,
  type Instant,
} from '@/core/domain/values';
import {
  validateReviewEvent,
  validateReviewState,
  type CardReviewState,
  type ReviewEvent,
} from '../domain/review';
import type { ReviewRepository } from '../domain/review-repository';

function mapState(source: ReturnType<typeof row>): CardReviewState | null {
  if (!source) return null;
  return validateReviewState({
    cardId: text(source, 'card_id'),
    box: integer(source, 'box') as CardReviewState['box'],
    dueDate: calendarDate(text(source, 'due_date')) as CalendarDate,
    lastReviewedAt: nullableText(source, 'last_reviewed_at')
      ? instant(nullableText(source, 'last_reviewed_at')!)
      : (null as Instant | null),
    consecutiveSuccesses: integer(source, 'consecutive_successes'),
    totalReviews: integer(source, 'total_reviews'),
    totalSuccesses: integer(source, 'total_successes'),
    updatedAt: instant(text(source, 'updated_at')),
  });
}

function mapEvent(source: ReturnType<typeof row>): ReviewEvent | null {
  if (!source) return null;
  return validateReviewEvent({
    id: text(source, 'id'),
    cardId: text(source, 'card_id'),
    deckId: text(source, 'deck_id'),
    previousBox: integer(source, 'previous_box') as ReviewEvent['previousBox'],
    newBox: integer(source, 'new_box') as ReviewEvent['newBox'],
    result: text(source, 'result') as ReviewEvent['result'],
    reviewedAt: instant(text(source, 'reviewed_at')),
    studySessionId: nullableText(source, 'study_session_id'),
  });
}

async function readState(
  database: Database | DatabaseTransaction,
  cardId: string,
): Promise<CardReviewState | null> {
  const result = await database.execute('SELECT * FROM card_review_state WHERE card_id = ?', [
    cardId,
  ]);
  return mapState(row(result));
}

export class SQLiteReviewRepository implements ReviewRepository {
  constructor(private readonly database: Database) {}

  getState(cardId: string): Promise<CardReviewState | null> {
    return databaseOperation(async () => {
      requiredId(cardId, 'Card ID');
      return readState(this.database, cardId);
    }, 'Unable to load review progress.');
  }

  listStates(cardIds: readonly string[]): Promise<CardReviewState[]> {
    return databaseOperation(async () => {
      const states: CardReviewState[] = [];
      for (const cardId of cardIds) {
        requiredId(cardId, 'Card ID');
        const state = await readState(this.database, cardId);
        if (state) states.push(state);
      }
      return states;
    }, 'Unable to load review progress.');
  }

  saveState(state: CardReviewState): Promise<CardReviewState> {
    return databaseOperation(async () => {
      const valid = validateReviewState(state);
      const existing = await readState(this.database, valid.cardId);
      if (existing && valid.updatedAt < existing.updatedAt)
        throw new AppError('conflict', 'Review state is older than the saved state.');
      await this.database.execute(
        `INSERT INTO card_review_state (card_id, box, due_date, last_reviewed_at, consecutive_successes, total_reviews, total_successes, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(card_id) DO UPDATE SET box = excluded.box, due_date = excluded.due_date, last_reviewed_at = excluded.last_reviewed_at,
             consecutive_successes = excluded.consecutive_successes, total_reviews = excluded.total_reviews,
             total_successes = excluded.total_successes, updated_at = excluded.updated_at`,
        [
          valid.cardId,
          valid.box,
          valid.dueDate,
          valid.lastReviewedAt,
          valid.consecutiveSuccesses,
          valid.totalReviews,
          valid.totalSuccesses,
          valid.updatedAt,
        ],
      );
      return valid;
    }, 'Unable to save review progress.');
  }

  addEvent(event: ReviewEvent): Promise<ReviewEvent> {
    return databaseOperation(async () => {
      const valid = validateReviewEvent(event);
      const existing = await this.database.execute('SELECT id FROM review_events WHERE id = ?', [
        valid.id,
      ]);
      if (existing.rows.length) throw new AppError('conflict', 'Review event already exists.');
      await this.insertEvent(this.database, valid);
      return valid;
    }, 'Unable to save the review event.');
  }

  record(event: ReviewEvent, state: CardReviewState): Promise<void> {
    return transactionOperation(
      this.database,
      async (transaction) => {
        const validEvent = validateReviewEvent(event);
        const validState = validateReviewState(state);
        const previous = await readState(transaction, validState.cardId);
        const existingEvent = await transaction.execute(
          'SELECT id FROM review_events WHERE id = ?',
          [validEvent.id],
        );
        if (existingEvent.rows.length)
          throw new AppError('conflict', 'Review event already exists.');
        if (
          validState.cardId !== validEvent.cardId ||
          validState.box !== validEvent.newBox ||
          (previous &&
            (previous.box !== validEvent.previousBox ||
              validState.totalReviews !== previous.totalReviews + 1)) ||
          (!previous && (validEvent.previousBox !== 1 || validState.totalReviews !== 1))
        )
          throw new AppError('validation', 'Review event and state disagree.');
        await this.writeState(transaction, validState);
        await this.insertEvent(transaction, validEvent);
      },
      'Unable to save the review.',
    );
  }

  listEvents(options: { cardId?: string; deckId?: string } = {}): Promise<ReviewEvent[]> {
    return databaseOperation(async () => {
      const conditions: string[] = [];
      const params: string[] = [];
      if (options.cardId) {
        conditions.push('card_id = ?');
        params.push(options.cardId);
      }
      if (options.deckId) {
        conditions.push('deck_id = ?');
        params.push(options.deckId);
      }
      const result = await this.database.execute(
        `SELECT * FROM review_events${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''} ORDER BY reviewed_at, id`,
        params,
      );
      return result.rows
        .map((source) => mapEvent(source))
        .filter((event): event is ReviewEvent => event !== null);
    }, 'Unable to load review history.');
  }

  private writeState(
    database: Database | DatabaseTransaction,
    state: CardReviewState,
  ): Promise<unknown> {
    return database.execute(
      `INSERT INTO card_review_state (card_id, box, due_date, last_reviewed_at, consecutive_successes, total_reviews, total_successes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(card_id) DO UPDATE SET box = excluded.box, due_date = excluded.due_date, last_reviewed_at = excluded.last_reviewed_at,
         consecutive_successes = excluded.consecutive_successes, total_reviews = excluded.total_reviews,
         total_successes = excluded.total_successes, updated_at = excluded.updated_at`,
      [
        state.cardId,
        state.box,
        state.dueDate,
        state.lastReviewedAt,
        state.consecutiveSuccesses,
        state.totalReviews,
        state.totalSuccesses,
        state.updatedAt,
      ],
    );
  }

  private insertEvent(
    database: Database | DatabaseTransaction,
    event: ReviewEvent,
  ): Promise<unknown> {
    return database.execute(
      `INSERT INTO review_events (id, card_id, deck_id, previous_box, new_box, result, reviewed_at, study_session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.cardId,
        event.deckId,
        event.previousBox,
        event.newBox,
        event.result,
        event.reviewedAt,
        event.studySessionId,
      ],
    );
  }
}
