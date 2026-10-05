import type { Database, DatabaseTransaction, SqlRow } from '@/core/database/database';
import { instant } from '@/core/domain/values';
import { reviewResult } from '@/features/study/domain/review';
import { mergeReviewEvents } from './review-merge';
import { randomUUID } from 'expo-crypto';
import type {
  PendingOperation,
  PullPage,
  ServerChange,
  SyncConflict,
  SyncEntityType,
} from './contract';

function value(row: SqlRow, key: string): string {
  const result = row[key];
  if (typeof result !== 'string') throw new Error(`Invalid local sync ${key}.`);
  return result;
}

function number(row: SqlRow, key: string): number {
  const result = row[key];
  if (typeof result !== 'number' || !Number.isSafeInteger(result))
    throw new Error(`Invalid local sync ${key}.`);
  return result;
}

function utc(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    throw new Error('Invalid server timestamp.');
  return new Date(value).toISOString();
}

function field(payload: Record<string, unknown>, key: string): string {
  const result = payload[key];
  if (typeof result !== 'string') throw new Error(`Invalid server ${key}.`);
  return result;
}

function optionalField(payload: Record<string, unknown>, key: string): string | null {
  const result = payload[key];
  if (result !== null && typeof result !== 'string') throw new Error(`Invalid server ${key}.`);
  return result;
}

function integerField(payload: Record<string, unknown>, key: string): number {
  const result = payload[key];
  if (typeof result !== 'number' || !Number.isSafeInteger(result))
    throw new Error(`Invalid server ${key}.`);
  return result;
}

export class SyncStore {
  constructor(private readonly database: Database) {}

  async account(): Promise<{ userId: string; deviceId: string; cursor: number }> {
    const result = await this.database.execute(
      'SELECT user_id, device_id, cursor FROM sync_account WHERE id = 1',
    );
    const first = result.rows[0];
    if (!first) throw new Error('Sync database is not initialized.');
    return {
      userId: value(first, 'user_id'),
      deviceId: value(first, 'device_id'),
      cursor: number(first, 'cursor'),
    };
  }

  async bind(userId: string): Promise<void> {
    const account = await this.account();
    if (account.userId && account.userId !== userId)
      throw new Error(
        'This offline database belongs to a different account. Sign in to the original account.',
      );
    await this.database.execute(
      'UPDATE sync_account SET user_id = ? WHERE id = 1 AND (user_id = ? OR user_id = ?)',
      [userId, '', userId],
    );
  }

  async pending(limit = 25): Promise<PendingOperation[]> {
    const result = await this.database.execute(
      `SELECT sequence, operation_id, entity_type, entity_id, operation, payload_json, expected_version, created_at, retry_count, status
       FROM sync_operations WHERE status = 'pending' ORDER BY sequence LIMIT ?`,
      [limit],
    );
    return result.rows.map((entry) => ({
      sequence: number(entry, 'sequence'),
      operationId: value(entry, 'operation_id'),
      entityType: value(entry, 'entity_type') as SyncEntityType,
      entityId: value(entry, 'entity_id'),
      operation: value(entry, 'operation') as PendingOperation['operation'],
      payload: JSON.parse(value(entry, 'payload_json')) as unknown,
      expectedVersion: number(entry, 'expected_version'),
      createdAt: value(entry, 'created_at'),
      retryCount: number(entry, 'retry_count'),
      status: 'pending',
    }));
  }

  async prepare(operation: PendingOperation): Promise<PendingOperation> {
    let expectedVersion = operation.expectedVersion;
    if (operation.retryCount === 0) {
      const prior = await this.database.execute(
        `SELECT MAX(ack_version) AS version FROM sync_operations
         WHERE entity_type = ? AND entity_id = ? AND sequence < ? AND status = 'synced'`,
        [operation.entityType, operation.entityId, operation.sequence],
      );
      const version = prior.rows[0]?.version;
      if (typeof version === 'number' && version > expectedVersion) expectedVersion = version;
    }
    await this.database.execute(
      'UPDATE sync_operations SET expected_version = ?, retry_count = retry_count + 1 WHERE operation_id = ? AND status = ?',
      [expectedVersion, operation.operationId, 'pending'],
    );
    return { ...operation, expectedVersion, retryCount: operation.retryCount + 1 };
  }

  async acknowledge(operation: PendingOperation, serverVersion: number): Promise<void> {
    const settingsUserId =
      operation.entityType === 'settings' ? (await this.account()).userId : null;
    await this.database.transaction(async (transaction) => {
      await transaction.execute(
        `UPDATE sync_operations SET status = 'synced', ack_version = ? WHERE operation_id = ? AND status = 'pending'`,
        [serverVersion, operation.operationId],
      );
      if (operation.entityType !== 'reviewEvent') {
        await transaction.execute(
          `INSERT INTO sync_entity_versions (entity_type, entity_id, server_version) VALUES (?, ?, ?)
           ON CONFLICT(entity_type, entity_id) DO UPDATE SET server_version = MAX(server_version, excluded.server_version)`,
          [operation.entityType, settingsUserId ?? operation.entityId, serverVersion],
        );
      } else {
        await transaction.execute(
          `INSERT OR IGNORE INTO sync_review_versions (event_id, server_version) VALUES (?, ?)`,
          [operation.entityId, serverVersion],
        );
      }
    });
  }

  async failed(operation: PendingOperation, retryable: boolean): Promise<void> {
    if (!retryable || operation.retryCount >= 5) {
      await this.database.execute('UPDATE sync_operations SET status = ? WHERE operation_id = ?', [
        'failed',
        operation.operationId,
      ]);
    }
  }

  async conflict(operation: PendingOperation, conflict: SyncConflict): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction.execute(
        `UPDATE sync_operations SET status = 'conflict' WHERE operation_id = ?`,
        [operation.operationId],
      );
      await transaction.execute(
        `INSERT INTO sync_conflicts (operation_id, server_value_json, client_value_json, actual_version, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(operation_id) DO UPDATE SET server_value_json = excluded.server_value_json,
           actual_version = excluded.actual_version`,
        [
          operation.operationId,
          JSON.stringify(conflict.serverValue),
          JSON.stringify(conflict.clientValue),
          conflict.actualVersion,
          new Date().toISOString(),
        ],
      );
    });
  }

  async conflicts(): Promise<
    {
      operationId: string;
      entityType: string;
      entityId: string;
      serverVersion: number;
      archived: boolean;
    }[]
  > {
    const result = await this.database.execute(
      `SELECT o.operation_id, o.entity_type, o.entity_id, c.actual_version, c.server_value_json
       FROM sync_operations o JOIN sync_conflicts c ON c.operation_id = o.operation_id
       WHERE o.status = 'conflict' ORDER BY o.sequence`,
    );
    return result.rows.map((entry) => ({
      operationId: value(entry, 'operation_id'),
      entityType: value(entry, 'entity_type'),
      entityId: value(entry, 'entity_id'),
      serverVersion: number(entry, 'actual_version'),
      archived:
        typeof entry.server_value_json === 'string' &&
        !!(JSON.parse(entry.server_value_json) as { archivedAtUtc?: string } | null)?.archivedAtUtc,
    }));
  }

  async counts(): Promise<{ pending: number; failed: number; conflict: number }> {
    const result = await this.database.execute(
      `SELECT status, COUNT(*) AS count FROM sync_operations WHERE status IN ('pending', 'failed', 'conflict') GROUP BY status`,
    );
    const counts = { pending: 0, failed: 0, conflict: 0 };
    for (const entry of result.rows) {
      const status = value(entry, 'status');
      if (status === 'pending' || status === 'failed' || status === 'conflict')
        counts[status] = number(entry, 'count');
    }
    return counts;
  }

  async retryFailed(): Promise<void> {
    await this.database.execute(
      `UPDATE sync_operations SET status = 'pending', retry_count = 1 WHERE status = 'failed'`,
    );
  }

  async applyPage(page: PullPage): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const cursor = await transaction.execute('SELECT cursor FROM sync_account WHERE id = 1');
      const current = number(cursor.rows[0]!, 'cursor');
      if (
        page.cursor < current ||
        page.cursor > page.latestVersion ||
        page.changes.length > 100 ||
        (page.changes.length === 0 && page.cursor !== current) ||
        (page.changes.length > 0 &&
          page.changes[page.changes.length - 1]!.serverVersion !== page.cursor) ||
        page.changes.some(
          (change, index) =>
            change.serverVersion !==
            (index === 0 ? current : page.changes[index - 1]!.serverVersion) + 1,
        )
      )
        throw new Error('Invalid server cursor.');
      await transaction.execute('UPDATE sync_account SET applying_remote = 1 WHERE id = 1');
      for (const change of page.changes) await this.applyChange(transaction, change);
      await transaction.execute(
        'UPDATE sync_account SET cursor = ?, applying_remote = 0 WHERE id = 1',
        [page.cursor],
      );
    });
  }

  private async applyChange(transaction: DatabaseTransaction, change: ServerChange): Promise<void> {
    if (change.entityType === 'reviewEvent') {
      await this.applyReviewEvent(transaction, change);
      return;
    }
    const entityId = change.entityId;
    const queued = await transaction.execute(
      `SELECT operation_id, payload_json FROM sync_operations WHERE entity_type = ? AND entity_id IN (?, '')
       AND status IN ('pending', 'conflict', 'failed') ORDER BY sequence LIMIT 1`,
      [change.entityType, entityId],
    );
    const own = await transaction.execute(
      `SELECT 1 AS found FROM sync_operations WHERE operation_id = ? AND status = 'synced'`,
      [change.clientChangeId],
    );
    if (queued.rows.length && !own.rows.length) {
      const operationId = value(queued.rows[0]!, 'operation_id');
      await transaction.execute(
        `UPDATE sync_operations SET status = 'conflict' WHERE operation_id = ?`,
        [operationId],
      );
      await transaction.execute(
        `INSERT INTO sync_conflicts (operation_id, server_value_json, client_value_json, actual_version, created_at)
         VALUES (?, ?, ?, ?, ?) ON CONFLICT(operation_id) DO UPDATE SET server_value_json = excluded.server_value_json, actual_version = excluded.actual_version`,
        [
          operationId,
          JSON.stringify(change.payload),
          value(queued.rows[0]!, 'payload_json'),
          change.serverVersion,
          new Date().toISOString(),
        ],
      );
    } else if (!queued.rows.length) {
      await this.applyMutable(transaction, change);
    }
    await transaction.execute(
      `INSERT INTO sync_entity_versions (entity_type, entity_id, server_version) VALUES (?, ?, ?)
       ON CONFLICT(entity_type, entity_id) DO UPDATE SET server_version = MAX(server_version, excluded.server_version)`,
      [change.entityType, entityId, change.serverVersion],
    );
  }

  private async applyMutable(
    transaction: DatabaseTransaction,
    change: ServerChange,
  ): Promise<void> {
    const payload = change.payload;
    const time = new Date().toISOString();
    if (change.entityType === 'deck') {
      if (change.operation === 'archive') {
        await transaction.execute(
          'UPDATE decks SET archived_at = MAX(created_at, ?), updated_at = MAX(created_at, ?) WHERE id = ?',
          [time, time, change.entityId],
        );
      } else {
        await transaction.execute(
          `INSERT INTO decks (id, name, description, language, text_alignment, typography_size, created_at, updated_at, archived_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description,
             language = excluded.language, text_alignment = excluded.text_alignment,
             typography_size = excluded.typography_size, updated_at = MAX(decks.created_at, excluded.updated_at)`,
          [
            change.entityId,
            field(payload, 'name'),
            field(payload, 'description'),
            field(payload, 'language'),
            field(payload, 'textAlignment'),
            field(payload, 'typographySize'),
            time,
            time,
          ],
        );
      }
    } else if (change.entityType === 'card') {
      if (change.operation === 'archive') {
        await transaction.execute(
          'UPDATE cards SET archived_at = MAX(created_at, ?), updated_at = MAX(created_at, ?) WHERE id = ?',
          [time, time, change.entityId],
        );
      } else {
        await transaction.execute(
          `INSERT INTO cards (id, deck_id, front_text, meaning, phonetic, category, examples_json, created_at, updated_at, archived_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
           ON CONFLICT(id) DO UPDATE SET front_text = excluded.front_text, meaning = excluded.meaning,
             phonetic = excluded.phonetic, category = excluded.category, examples_json = excluded.examples_json,
             updated_at = MAX(cards.created_at, excluded.updated_at)`,
          [
            change.entityId,
            field(payload, 'deckId'),
            field(payload, 'frontText'),
            field(payload, 'meaning'),
            optionalField(payload, 'phonetic'),
            optionalField(payload, 'category'),
            JSON.stringify(payload.examples),
            time,
            time,
          ],
        );
        const state = await transaction.execute(
          'SELECT 1 AS found FROM card_review_state WHERE card_id = ?',
          [change.entityId],
        );
        if (!state.rows.length) {
          await transaction.execute(
            `INSERT INTO card_review_state
            (card_id, box, due_date, last_reviewed_at, consecutive_successes, total_reviews, total_successes, updated_at)
            VALUES (?, 1, ?, NULL, 0, 0, 0, ?)`,
            [change.entityId, time.slice(0, 10), time],
          );
        }
      }
    } else if (change.entityType === 'settings') {
      await transaction.execute(
        `INSERT INTO user_settings (id, theme, haptics_enabled, language, daily_reminder_enabled,
          daily_reminder_time, preferred_speech_language, preferred_speech_accent)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET theme = excluded.theme, haptics_enabled = excluded.haptics_enabled,
           language = excluded.language, daily_reminder_enabled = excluded.daily_reminder_enabled,
           daily_reminder_time = excluded.daily_reminder_time, preferred_speech_language = excluded.preferred_speech_language,
           preferred_speech_accent = excluded.preferred_speech_accent`,
        [
          field(payload, 'theme'),
          payload.hapticsEnabled === true ? 1 : 0,
          field(payload, 'language'),
          payload.dailyReminderEnabled === true ? 1 : 0,
          optionalField(payload, 'dailyReminderTime')?.slice(0, 5) ?? null,
          field(payload, 'preferredSpeechLanguage'),
          optionalField(payload, 'preferredSpeechAccent'),
        ],
      );
    } else if (change.entityType === 'reviewState') {
      const events = await transaction.execute(
        'SELECT 1 AS found FROM review_events WHERE card_id = ? LIMIT 1',
        [change.entityId],
      );
      if (events.rows.length) return;
      await transaction.execute(
        `INSERT INTO card_review_state (card_id, box, due_date, last_reviewed_at, consecutive_successes, total_reviews, total_successes, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(card_id) DO UPDATE SET box = excluded.box, due_date = excluded.due_date,
           last_reviewed_at = excluded.last_reviewed_at, consecutive_successes = excluded.consecutive_successes,
           total_reviews = excluded.total_reviews, total_successes = excluded.total_successes, updated_at = excluded.updated_at`,
        [
          change.entityId,
          integerField(payload, 'box'),
          field(payload, 'dueDate'),
          payload.lastReviewedAtUtc ? utc(payload.lastReviewedAtUtc) : null,
          integerField(payload, 'consecutiveSuccesses'),
          integerField(payload, 'totalReviews'),
          integerField(payload, 'totalSuccesses'),
          time,
        ],
      );
    } else {
      throw new Error('Unsupported server sync entity.');
    }
  }

  private async applyReviewEvent(
    transaction: DatabaseTransaction,
    change: ServerChange,
  ): Promise<void> {
    const payload = change.payload;
    const cardId = field(payload, 'cardId');
    const deckId = field(payload, 'deckId');
    const reviewedAt = utc(payload.reviewedAtUtc);
    const existing = await transaction.execute(
      'SELECT card_id, deck_id, previous_box, new_box, result, reviewed_at FROM review_events WHERE id = ?',
      [change.entityId],
    );
    if (existing.rows.length) {
      const saved = existing.rows[0]!;
      if (
        value(saved, 'card_id') !== cardId ||
        value(saved, 'deck_id') !== deckId ||
        number(saved, 'previous_box') !== integerField(payload, 'previousBox') ||
        number(saved, 'new_box') !== integerField(payload, 'newBox') ||
        value(saved, 'result') !== field(payload, 'result') ||
        value(saved, 'reviewed_at') !== reviewedAt
      )
        throw new Error('Review event identity collision; history was preserved.');
    }
    await transaction.execute(
      `INSERT OR IGNORE INTO review_events (id, card_id, deck_id, previous_box, new_box, result, reviewed_at, study_session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        change.entityId,
        cardId,
        deckId,
        integerField(payload, 'previousBox'),
        integerField(payload, 'newBox'),
        field(payload, 'result'),
        reviewedAt,
        optionalField(payload, 'studySessionId'),
      ],
    );
    await transaction.execute(
      'INSERT OR IGNORE INTO sync_review_versions (event_id, server_version) VALUES (?, ?)',
      [change.entityId, change.serverVersion],
    );
    await this.replayReviews(transaction, cardId);
  }

  private async replayReviews(transaction: DatabaseTransaction, cardId: string): Promise<void> {
    const card = await transaction.execute('SELECT created_at FROM cards WHERE id = ?', [cardId]);
    if (!card.rows[0]) throw new Error('Review event card is missing.');
    const events = await transaction.execute(
      `SELECT e.result, e.reviewed_at FROM review_events e
       LEFT JOIN sync_review_versions v ON v.event_id = e.id WHERE e.card_id = ?
       ORDER BY CASE WHEN v.server_version IS NULL THEN 1 ELSE 0 END, v.server_version, e.reviewed_at, e.id`,
      [cardId],
    );
    const createdAt = instant(value(card.rows[0], 'created_at'));
    const state = mergeReviewEvents(
      cardId,
      createdAt,
      events.rows.map((event) => ({
        reviewedAt: instant(value(event, 'reviewed_at')),
        result: reviewResult(value(event, 'result')),
      })),
    );
    await transaction.execute(
      `INSERT INTO card_review_state (card_id, box, due_date, last_reviewed_at, consecutive_successes, total_reviews, total_successes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(card_id) DO UPDATE SET box = excluded.box, due_date = excluded.due_date,
         last_reviewed_at = excluded.last_reviewed_at, consecutive_successes = excluded.consecutive_successes,
         total_reviews = excluded.total_reviews, total_successes = excluded.total_successes, updated_at = excluded.updated_at`,
      [
        cardId,
        state.box ?? 1,
        state.dueDate,
        state.lastReviewedAt,
        state.consecutiveSuccesses,
        state.totalReviews,
        state.totalSuccesses,
        state.updatedAt,
      ],
    );
  }

  async resolve(operationId: string, choice: 'server' | 'local'): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const found = await transaction.execute(
        `SELECT o.entity_type, o.entity_id, o.operation, o.payload_json, c.server_value_json, c.actual_version
         FROM sync_operations o JOIN sync_conflicts c ON c.operation_id = o.operation_id
         WHERE o.operation_id = ? AND o.status = 'conflict'`,
        [operationId],
      );
      const item = found.rows[0];
      if (!item) throw new Error('Sync conflict no longer exists.');
      const entityType = value(item, 'entity_type') as SyncEntityType;
      if (entityType === 'reviewState' || entityType === 'reviewEvent')
        throw new Error('Review conflicts require inspecting and preserving both histories.');
      const actualVersion = number(item, 'actual_version');
      const serverJson = value(item, 'server_value_json');
      if (choice === 'server') {
        if (serverJson === 'null')
          throw new Error('Server snapshot unavailable; retry synchronization.');
        const payload = JSON.parse(serverJson) as Record<string, unknown>;
        await transaction.execute('UPDATE sync_account SET applying_remote = 1 WHERE id = 1');
        await this.applyMutable(transaction, {
          entityType,
          entityId: value(item, 'entity_id'),
          operation: payload.archivedAtUtc ? 'archive' : 'upsert',
          payload,
          serverVersion: actualVersion,
          deviceId: '',
          clientChangeId: '',
          clientChangedAtUtc: '',
        });
        await transaction.execute('UPDATE sync_account SET applying_remote = 0 WHERE id = 1');
      } else {
        if ((JSON.parse(serverJson) as { archivedAtUtc?: string } | null)?.archivedAtUtc)
          throw new Error('Archived cards and decks cannot be edited again.');
        await transaction.execute(
          `INSERT INTO sync_operations (operation_id, entity_type, entity_id, operation, payload_json, expected_version, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(),
            entityType,
            value(item, 'entity_id'),
            value(item, 'operation'),
            value(item, 'payload_json'),
            actualVersion,
            new Date().toISOString(),
          ],
        );
      }
      await transaction.execute(
        `UPDATE sync_operations SET status = 'discarded' WHERE operation_id = ?`,
        [operationId],
      );
      await transaction.execute(`DELETE FROM sync_conflicts WHERE operation_id = ?`, [operationId]);
    });
  }
}
