import type { Database, DatabaseTransaction, SqlResult, SqlValue } from '@/core/database/database';
import { runMigrations } from '@/core/database/migrations';
import { calendarDate, instant } from '@/core/domain/values';
import { createReviewEngine } from '@/features/study/domain/review-engine-impl';
import { mergeReviewEvents } from '@/core/sync/review-merge';
import type { PullPage, ServerChange } from '@/core/sync/contract';

export const replayTime = '2026-11-14T12:00:00.000Z';
export const historySql = 'SELECT e.id, e.result, e.reviewed_at';
export const projectionSql = 'INSERT INTO card_review_state';

export function remoteChange(
  entityType: ServerChange['entityType'],
  entityId: string,
  serverVersion: number,
  payload: Record<string, unknown>,
): ServerChange {
  return {
    entityType,
    entityId,
    serverVersion,
    payload,
    operation: entityType === 'reviewEvent' ? 'create' : 'upsert',
    deviceId: 'synthetic-remote',
    clientChangeId: `remote-${serverVersion}`,
    clientChangedAtUtc: replayTime,
  };
}

/** Fixed-seed histories deliberately include equal and backwards timestamps and regular failures. */
export function reviewChanges(count: number, cards = 1, firstVersion = 1): ServerChange[] {
  let seed = 92821;
  return Array.from({ length: count }, (_, index) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const time = new Date(Date.UTC(2026, 9, 1, 21, 30, seed % 1000)).toISOString();
    const date = new Date(Date.parse(time) + 210 * 60000).toISOString().slice(0, 10);
    return remoteChange('reviewEvent', `event-${index}`, firstVersion + index, {
      cardId: `card-${index % cards}`,
      deckId: 'deck',
      previousBox: 1,
      newBox: 2,
      result: Math.floor(index / cards) % 4 === 3 ? 'failure' : 'success',
      reviewedAtUtc: time,
      reviewCalendar: { reviewDate: date, utcOffsetMinutes: 210 },
      studySessionId: null,
    });
  });
}

export function reviewPages(changes: ServerChange[], size = 100): PullPage[] {
  return Array.from({ length: Math.ceil(changes.length / size) }, (_, index) => {
    const part = changes.slice(index * size, (index + 1) * size);
    return {
      changes: part,
      cursor: part.at(-1)!.serverVersion,
      latestVersion: changes.at(-1)!.serverVersion,
      hasMore: (index + 1) * size < changes.length,
    };
  });
}

export async function seedReplayDatabase(database: Database, schedulerId = 'leitner', cards = 1) {
  await runMigrations(database);
  await database.transaction(async (tx) => {
    await tx.execute('UPDATE sync_account SET applying_remote=1 WHERE id=1');
    await tx.execute(
      `INSERT INTO decks (id,name,description,language,text_alignment,typography_size,
      review_system,created_at,updated_at) VALUES ('deck','Synthetic','','en','ltr','medium',?,?,?)`,
      [schedulerId, replayTime, replayTime],
    );
    for (let index = 0; index < cards; index++) {
      const id = `card-${index}`;
      await tx.execute(
        `INSERT INTO cards (id,deck_id,front_text,meaning,examples_json,created_at,updated_at)
        VALUES (?,'deck','term','meaning','[]',?,?)`,
        [id, replayTime, replayTime],
      );
      const state = createReviewEngine()
        .getScheduler(schedulerId)
        .createInitialState(id, calendarDate(replayTime.slice(0, 10)), instant(replayTime));
      await tx.execute(
        `INSERT INTO card_review_state (card_id,box,due_date,last_reviewed_at,
        consecutive_successes,total_reviews,total_successes,updated_at,scheduler_state_json)
        VALUES (?,1,?,NULL,0,0,0,?,?)`,
        [
          id,
          state.dueDate,
          state.updatedAt,
          state.schedulerState ? JSON.stringify(state.schedulerState) : null,
        ],
      );
    }
    await tx.execute('UPDATE sync_account SET applying_remote=0 WHERE id=1');
  });
}

export function checkpointFor(
  changes: ServerChange[],
  cardId: string,
  schedulerId: string,
  throughVersion: number,
) {
  const state = mergeReviewEvents(
    cardId,
    instant(replayTime),
    changes
      .filter((c) => c.payload.cardId === cardId)
      .map((c) => ({
        id: c.entityId,
        serverVersion: c.serverVersion,
        reviewedAt: instant(String(c.payload.reviewedAtUtc)),
        result: c.payload.result as 'success' | 'failure',
        reviewCalendar: c.payload.reviewCalendar as {
          reviewDate: ReturnType<typeof calendarDate>;
          utcOffsetMinutes: number;
        },
      })),
    createReviewEngine().getScheduler(schedulerId),
  );
  return {
    cardId,
    throughVersion,
    state: {
      box: state.box ?? 1,
      dueDate: state.dueDate,
      lastReviewedAtUtc: state.lastReviewedAt,
      consecutiveSuccesses: state.consecutiveSuccesses,
      totalReviews: state.totalReviews,
      totalSuccesses: state.totalSuccesses,
      ...(state.schedulerState ? { schedulerState: state.schedulerState } : {}),
    },
  };
}

/** Observes real SQL/results, without adding instrumentation to production. */
export class ReplayMetricsDatabase implements Database {
  historyQueries = 0;
  historyRows = 0;
  projectionWrites = 0;
  insertedEvents = 0;
  transactions = 0;
  transactionMs: number[] = [];
  afterExecute?: (
    sql: string,
    params: readonly SqlValue[] | undefined,
    result: SqlResult,
  ) => void | Promise<void>;
  constructor(readonly database: Database) {}
  private async observed(tx: DatabaseTransaction, sql: string, params?: readonly SqlValue[]) {
    const result = await tx.execute(sql, params);
    if (sql.includes(historySql)) {
      this.historyQueries++;
      this.historyRows += result.rows.length;
    }
    if (sql.includes(projectionSql)) this.projectionWrites++;
    if (sql.includes('INSERT OR IGNORE INTO review_events'))
      this.insertedEvents += result.rowsAffected;
    await this.afterExecute?.(sql, params, result);
    return result;
  }
  execute(sql: string, params?: readonly SqlValue[]) {
    return this.observed(this.database, sql, params);
  }
  async transaction(operation: (tx: DatabaseTransaction) => Promise<void>) {
    this.transactions++;
    const start = performance.now();
    try {
      await this.database.transaction((tx) =>
        operation({ execute: (sql, params) => this.observed(tx, sql, params) }),
      );
    } finally {
      this.transactionMs.push(performance.now() - start);
    }
  }
}
