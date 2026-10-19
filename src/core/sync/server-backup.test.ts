import { validateBackupMetadata, validateServerBackup } from './server-backup';

const completedAtUtc = new Date().toISOString();
const valid = {
  id: '11111111-1111-1111-1111-111111111111',
  status: 'Completed',
  formatVersion: 1,
  createdAtUtc: completedAtUtc,
  completedAtUtc,
  expiresAtUtc: new Date(Date.parse(completedAtUtc) + 7 * 86_400_000).toISOString(),
  retentionDays: 7,
  syncVersion: 4,
  sizeBytes: 1000,
  isExpired: false,
  canRestore: false,
};

test('completed format-v1 receipt preserves confirmed retention, size and sync version', () => {
  expect(validateServerBackup(valid, 4)).toEqual(valid);
});

test('an expired historical receipt may be displayed after restart but cannot confirm a new backup', () => {
  const expired = {
    ...valid,
    createdAtUtc: '2020-01-01T00:00:00.000Z',
    completedAtUtc: '2020-01-01T00:00:00.000Z',
    expiresAtUtc: '2020-01-08T00:00:00.000Z',
  };
  expect(validateServerBackup(expired, 0, true)).toEqual(expired);
  expect(() => validateServerBackup(expired, 0)).toThrow('No retained backup is confirmed');
});

test.each([
  { status: 'Pending' },
  { status: 'Failed' },
  { formatVersion: 2 },
  { syncVersion: 3 },
  { sizeBytes: 0 },
  { sizeBytes: 1.5 },
  { retentionDays: 0 },
  { retentionDays: 8 },
  { expiresAtUtc: '2020-01-01T00:00:00Z' },
  { isExpired: true },
  { canRestore: true },
  { id: 'not-an-id' },
  { completedAtUtc: null },
])('incomplete or incompatible receipt cannot be claimed as a retained backup: %j', (patch) => {
  expect(() => validateServerBackup({ ...valid, ...patch }, 4)).toThrow(
    'No retained backup is confirmed',
  );
});

test.each(['Pending', 'Failed', 'Expired'] as const)(
  'status metadata supports %s without pretending completion',
  (status) => {
    const row = {
      ...valid,
      status,
      isExpired: status === 'Expired',
      completedAtUtc: null,
      syncVersion: null,
      sizeBytes: null,
      failureCode: status === 'Failed' ? 'backup_storage_failed' : null,
    };
    expect(validateBackupMetadata(row)).toEqual(row);
    expect(() => validateServerBackup(row, 0)).toThrow();
  },
);

test('expired completed metadata preserves historical local display dates without confirming a new backup', () => {
  const row = {
    ...valid,
    failureCode: null,
    status: 'Expired',
    isExpired: true,
    createdAtUtc: '2020-01-01T00:00:00Z',
    completedAtUtc: '2020-01-01T00:00:00Z',
    expiresAtUtc: '2020-01-08T00:00:00Z',
  };
  expect(validateBackupMetadata(row)).toEqual(row);
  expect(() => validateServerBackup(row, 0)).toThrow();
});

test.each([
  null,
  {},
  { ...valid, failureCode: null, status: 'Failed' },
  { ...valid, failureCode: null, status: 'Expired' },
  { ...valid, failureCode: null, formatVersion: 2 },
  { ...valid, failureCode: null, canRestore: true },
])('malformed or incompatible status metadata is rejected: %j', (value) => {
  expect(() => validateBackupMetadata(value)).toThrow();
});
