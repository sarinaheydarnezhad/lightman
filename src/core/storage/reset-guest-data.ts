import { randomUUID } from 'expo-crypto';
import type { Database } from '@/core/database/database';
import { AppError } from '@/core/errors/app-error';
import { snapshot, type GuestSnapshot } from '@/core/sync/guest-transfer-snapshot';

export async function resetGuestData(
  database: Database,
  expected?: GuestSnapshot,
  assertCurrent: () => void = () => {},
): Promise<void> {
  await database.transaction(async (transaction) => {
    assertCurrent();
    const owner = (await transaction.execute('SELECT user_id FROM sync_account WHERE id = 1'))
      .rows[0]?.user_id;
    if (owner !== '') throw new AppError('conflict', 'Only guest data can be removed.');
    if (expected && JSON.stringify(await snapshot(transaction)) !== JSON.stringify(expected))
      throw new AppError(
        'conflict',
        'The guest data changed. Refresh the preview before continuing.',
      );
    const trigger = (
      await transaction.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'review_events_no_delete'",
      )
    ).rows[0]?.sql;
    if (typeof trigger !== 'string')
      throw new AppError('persistence', 'The review history protection is unavailable.');
    await transaction.execute('UPDATE sync_account SET applying_remote = 1 WHERE id = 1');
    await transaction.execute('DROP TRIGGER review_events_no_delete');
    for (const table of [
      'sync_conflicts',
      'sync_review_versions',
      'sync_operations',
      'sync_entity_versions',
      'guest_transfers',
      'study_sessions',
      'review_events',
      'card_review_state',
      'cards',
      'decks',
    ])
      await transaction.execute(`DELETE FROM ${table}`);
    const entitlements = await transaction.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'local_entitlements'",
    );
    if (entitlements.rows.length) await transaction.execute('DELETE FROM local_entitlements');
    const intent = await transaction.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'guest_reset_intent'",
    );
    if (intent.rows.length) await transaction.execute('DELETE FROM guest_reset_intent');
    await transaction.execute(trigger);
    await transaction.execute(
      'UPDATE sync_account SET device_id = ?, cursor = 0, applying_remote = 0 WHERE id = 1',
      [randomUUID()],
    );
    assertCurrent();
  });
}
