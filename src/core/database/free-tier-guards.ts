import type { Database } from './database';
import {
  freeLearningLimits,
  provisionalEntitlementLifetimeMs,
} from '@/core/access/learning-access';

export async function installFreeTierGuards(database: Database): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.execute(`CREATE TABLE IF NOT EXISTS local_entitlements (
      user_id TEXT PRIMARY KEY NOT NULL, response_json TEXT NOT NULL,
      fetched_at_ms INTEGER NOT NULL, valid_until_ms INTEGER NOT NULL
    )`);
    const timestamp = `(CAST(strftime('%s', 'now') AS INTEGER) * 1000 + CAST(substr(strftime('%f', 'now'), 4, 3) AS INTEGER))`;
    const withinLease = `${timestamp} >= fetched_at_ms AND ${timestamp} < valid_until_ms AND valid_until_ms - fetched_at_ms <= ${provisionalEntitlementLifetimeMs}`;
    const paid = `EXISTS (SELECT 1 FROM local_entitlements WHERE user_id <> '' AND user_id = (SELECT user_id FROM sync_account WHERE id = 1) AND ${withinLease} AND json_extract(response_json, '$.currentPlan') = 'Plus' AND json_extract(response_json, '$.isActive') = 1)`;
    const local = `(SELECT applying_remote FROM sync_account WHERE id = 1) = 0 AND NOT (${paid})`;
    const over = `(SELECT COUNT(*) FROM decks WHERE archived_at IS NULL) > ${freeLearningLimits.decks} OR (SELECT COUNT(*) FROM cards WHERE archived_at IS NULL) > ${freeLearningLimits.cards}`;
    for (const [table, maximum, code] of [
      ['decks', freeLearningLimits.decks, 'free_tier_deck_limit'],
      ['cards', freeLearningLimits.cards, 'free_tier_card_limit'],
    ] as const) {
      const condition = `NEW.archived_at IS NULL AND ${local} AND ((SELECT COUNT(*) FROM ${table} WHERE archived_at IS NULL) >= ${maximum} OR ${over})`;
      await transaction.execute(`DROP TRIGGER IF EXISTS free_tier_${table}_insert`);
      await transaction.execute(`DROP TRIGGER IF EXISTS free_tier_${table}_restore`);
      await transaction.execute(
        `CREATE TRIGGER IF NOT EXISTS free_tier_${table}_insert BEFORE INSERT ON ${table} WHEN ${condition} BEGIN SELECT RAISE(ABORT, '${code}'); END`,
      );
      await transaction.execute(
        `CREATE TRIGGER IF NOT EXISTS free_tier_${table}_restore BEFORE UPDATE OF archived_at ON ${table} WHEN OLD.archived_at IS NOT NULL AND ${condition} BEGIN SELECT RAISE(ABORT, '${code}'); END`,
      );
    }
    await transaction.execute(`DROP TRIGGER IF EXISTS free_tier_review_insert`);
    await transaction.execute(
      `CREATE TRIGGER free_tier_review_insert BEFORE INSERT ON review_events WHEN ${local} AND (${over}) BEGIN SELECT RAISE(ABORT, 'free_tier_dataset_limit'); END`,
    );
    await transaction.execute('DROP TRIGGER IF EXISTS free_tier_review_state_update');
    await transaction.execute(
      `CREATE TRIGGER free_tier_review_state_update BEFORE UPDATE ON card_review_state WHEN ${local} AND (${over}) BEGIN SELECT RAISE(ABORT, 'free_tier_dataset_limit'); END`,
    );
    await transaction.execute('DROP TRIGGER IF EXISTS free_tier_session_insert');
    await transaction.execute(
      `CREATE TRIGGER free_tier_session_insert BEFORE INSERT ON study_sessions WHEN ${local} AND (${over}) BEGIN SELECT RAISE(ABORT, 'free_tier_dataset_limit'); END`,
    );
    await transaction.execute('DROP TRIGGER IF EXISTS free_tier_session_update');
    await transaction.execute(
      `CREATE TRIGGER free_tier_session_update BEFORE UPDATE ON study_sessions WHEN NEW.status <> 'cancelled' AND ${local} AND (${over}) BEGIN SELECT RAISE(ABORT, 'free_tier_dataset_limit'); END`,
    );
  });
}
