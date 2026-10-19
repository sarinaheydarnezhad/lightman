export interface ServerBackup {
  readonly id: string;
  readonly status: 'Completed';
  readonly formatVersion: 1;
  readonly createdAtUtc: string;
  readonly completedAtUtc: string;
  readonly expiresAtUtc: string;
  readonly retentionDays: number;
  readonly syncVersion: number;
  readonly sizeBytes: number;
  readonly isExpired: false;
  readonly canRestore: false;
}

const identity = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BackupMetadata {
  readonly id: string;
  readonly status: 'Pending' | 'Completed' | 'Failed' | 'Expired';
  readonly formatVersion: 1;
  readonly createdAtUtc: string;
  readonly completedAtUtc: string | null;
  readonly expiresAtUtc: string;
  readonly retentionDays: number;
  readonly syncVersion: number | null;
  readonly sizeBytes: number | null;
  readonly failureCode: string | null;
  readonly isExpired: boolean;
  readonly canRestore: false;
}

export interface BackupOverview {
  readonly latest: BackupMetadata | null;
  readonly lastSuccessful: BackupMetadata | null;
}

export function validateBackupMetadata(value: unknown): BackupMetadata {
  const row = value as BackupMetadata | null;
  if (
    !row ||
    typeof row.id !== 'string' ||
    !identity.test(row.id) ||
    !['Pending', 'Completed', 'Failed', 'Expired'].includes(row.status) ||
    row.formatVersion !== 1 ||
    typeof row.createdAtUtc !== 'string' ||
    !Number.isFinite(Date.parse(row.createdAtUtc)) ||
    typeof row.expiresAtUtc !== 'string' ||
    !Number.isFinite(Date.parse(row.expiresAtUtc)) ||
    Date.parse(row.expiresAtUtc) <= Date.parse(row.createdAtUtc) ||
    !Number.isInteger(row.retentionDays) ||
    row.retentionDays < 1 ||
    row.retentionDays > 3650 ||
    typeof row.isExpired !== 'boolean' ||
    (row.status === 'Expired') !== row.isExpired ||
    row.canRestore !== false ||
    (row.failureCode !== null &&
      (typeof row.failureCode !== 'string' || !/^[a-z_]{1,100}$/.test(row.failureCode)))
  )
    throw new Error('Invalid server backup metadata. Refresh or try again later.');
  if (row.status === 'Completed' || (row.status === 'Expired' && row.completedAtUtc !== null)) {
    validateServerBackup({ ...row, status: 'Completed', isExpired: false }, 0, true);
    if (row.failureCode !== null)
      throw new Error('Invalid completed backup metadata. Refresh or try again later.');
  } else if (row.completedAtUtc !== null || row.sizeBytes !== null || row.syncVersion !== null) {
    throw new Error('Invalid incomplete backup metadata. Refresh or try again later.');
  }
  return row;
}

export function validateServerBackup(
  value: unknown,
  expectedVersion: number,
  allowExpiredReceipt = false,
): ServerBackup {
  const backup = value as ServerBackup | null;
  if (
    !backup ||
    typeof backup.id !== 'string' ||
    !identity.test(backup.id) ||
    backup.status !== 'Completed' ||
    backup.formatVersion !== 1 ||
    backup.isExpired !== false ||
    backup.canRestore !== false ||
    typeof backup.createdAtUtc !== 'string' ||
    !Number.isFinite(Date.parse(backup.createdAtUtc)) ||
    typeof backup.completedAtUtc !== 'string' ||
    !Number.isFinite(Date.parse(backup.completedAtUtc)) ||
    typeof backup.expiresAtUtc !== 'string' ||
    !Number.isFinite(Date.parse(backup.expiresAtUtc)) ||
    Date.parse(backup.completedAtUtc) < Date.parse(backup.createdAtUtc) ||
    (!allowExpiredReceipt && Date.parse(backup.expiresAtUtc) <= Date.now()) ||
    !Number.isInteger(backup.retentionDays) ||
    backup.retentionDays < 1 ||
    backup.retentionDays > 3650 ||
    Date.parse(backup.expiresAtUtc) - Date.parse(backup.completedAtUtc) !==
      backup.retentionDays * 86_400_000 ||
    !Number.isSafeInteger(backup.syncVersion) ||
    backup.syncVersion < expectedVersion ||
    !Number.isSafeInteger(backup.sizeBytes) ||
    backup.sizeBytes <= 0
  )
    throw new Error(
      'The server backup is incomplete, expired, or incompatible. No retained backup is confirmed.',
    );
  return backup;
}
