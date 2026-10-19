import type { Database } from './database';
import { reconcileEntitlementCache, type EntitlementCache } from '@/core/access/learning-access';
import { AppError } from '@/core/errors/app-error';
import { validateEntitlements } from '@/core/sync/subscription';

export async function readEntitlementCache(
  database: Database,
  userId: string,
): Promise<EntitlementCache | null> {
  const row = (
    await database.execute('SELECT * FROM local_entitlements WHERE user_id = ?', [userId])
  ).rows[0];
  if (!row) return null;
  try {
    return {
      entitlements: validateEntitlements(JSON.parse(String(row.response_json))),
      fetchedAt: Number(row.fetched_at_ms),
      validUntil: Number(row.valid_until_ms),
    };
  } catch {
    return null;
  }
}

export async function writeEntitlementCache(
  database: Database,
  userId: string,
  cache: EntitlementCache | null,
): Promise<EntitlementCache | null> {
  if (!cache) {
    await database.execute('DELETE FROM local_entitlements WHERE user_id = ?', [userId]);
    return null;
  }
  cache = reconcileEntitlementCache(await readEntitlementCache(database, userId), cache);
  const oldTime =
    "CASE WHEN json_valid(local_entitlements.response_json) THEN julianday(json_extract(local_entitlements.response_json, '$.validatedAtUtc')) ELSE NULL END";
  const newTime = "julianday(json_extract(excluded.response_json, '$.validatedAtUtc'))";
  const oldPaid =
    "CASE WHEN json_valid(local_entitlements.response_json) THEN json_extract(local_entitlements.response_json, '$.isActive') = 1 ELSE 0 END";
  const newPaid = "json_extract(excluded.response_json, '$.isActive') = 1";
  const samePaid = `${oldTime} = ${newTime} AND ${oldPaid} AND ${newPaid}`;
  await database.execute(
    `INSERT INTO local_entitlements (user_id, response_json, fetched_at_ms, valid_until_ms)
    SELECT ?, ?, ?, ? WHERE (SELECT user_id FROM sync_account WHERE id = 1) = ?
    ON CONFLICT(user_id) DO UPDATE SET
      fetched_at_ms = CASE WHEN ${samePaid} THEN local_entitlements.fetched_at_ms ELSE excluded.fetched_at_ms END,
      valid_until_ms = CASE WHEN ${samePaid} THEN MIN(local_entitlements.valid_until_ms, excluded.valid_until_ms) ELSE excluded.valid_until_ms END,
      response_json = excluded.response_json
    WHERE (${oldTime}) IS NULL OR (${newTime} >= (${oldTime}) AND NOT (${newTime} = (${oldTime}) AND NOT (${oldPaid}) AND ${newPaid}))`,
    [userId, JSON.stringify(cache.entitlements), cache.fetchedAt, cache.validUntil, userId],
  );
  const stored = await readEntitlementCache(database, userId);
  if (!stored)
    throw new AppError(
      'unavailable',
      'Account entitlement storage is unavailable. Refresh online.',
    );
  return stored;
}
