import type { Database } from './database';

export async function installFreeTierGuards(database: Database): Promise<void> {
  await database.transaction(async (transaction) => {
    for (const [table, maximum, code] of [
      ['decks', 1, 'free_tier_deck_limit'],
      ['cards', 50, 'free_tier_card_limit'],
    ] as const) {
      const condition = `NEW.archived_at IS NULL AND (SELECT applying_remote FROM sync_account WHERE id = 1) = 0 AND (SELECT COUNT(*) FROM ${table} WHERE archived_at IS NULL) >= ${maximum}`;
      await transaction.execute(
        `CREATE TRIGGER IF NOT EXISTS free_tier_${table}_insert BEFORE INSERT ON ${table} WHEN ${condition} BEGIN SELECT RAISE(ABORT, '${code}'); END`,
      );
      await transaction.execute(
        `CREATE TRIGGER IF NOT EXISTS free_tier_${table}_restore BEFORE UPDATE OF archived_at ON ${table} WHEN OLD.archived_at IS NOT NULL AND ${condition} BEGIN SELECT RAISE(ABORT, '${code}'); END`,
      );
    }
  });
}
