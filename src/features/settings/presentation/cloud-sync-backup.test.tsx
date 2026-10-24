import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { CloudSyncScreen } from './cloud-sync-screen';
import { syncEngine } from '@/core/composition/sync';
import type { StorageState } from '@/core/storage/local-storage-scopes';
import { CloudError } from '@/core/sync/cloud-client';
import type { BackupMetadata, BackupOverview } from '@/core/sync/server-backup';
import { useLocalization } from '@/shared/localization/localization-provider';
import {
  translate,
  formatNumber,
  resolveDirection,
  type UiLanguage,
} from '@/shared/localization/localization';

let mockState: StorageState = { phase: 'ready', mode: 'guest', userId: null, revision: 0 };
const mockListeners = new Set<() => void>();
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => (() => void) | void) => {
    const react = jest.requireActual<typeof import('react')>('react');
    react.useEffect(effect, [effect]);
  },
}));
jest.mock('@/core/composition/application', () => ({ application: {} }));
jest.mock('@/core/composition/repositories', () => ({
  storageScopes: {
    snapshot: () => mockState,
    subscribe: (listener: () => void) => {
      mockListeners.add(listener);
      return () => mockListeners.delete(listener);
    },
  },
}));
jest.mock('@/core/composition/sync', () => ({
  syncEngine: {
    available: true,
    status: jest.fn(),
    backupStatus: jest.fn(),
    createBackup: jest.fn(),
  },
}));
jest.mock('@/shared/localization/localization-provider', () => ({ useLocalization: jest.fn() }));
const engine = syncEngine!;
function setLanguage(language: UiLanguage) {
  jest.mocked(useLocalization).mockReturnValue({
    language,
    direction: resolveDirection(language),
    t: (key, values) => translate(language, key, values),
    number: (value) => formatNumber(value, language),
  });
}
function update(state: StorageState) {
  act(() => {
    mockState = state;
    mockListeners.forEach((listener) => listener());
  });
}
function authenticated() {
  mockState = { phase: 'ready', mode: 'account', userId: 'account-a', revision: 1 };
  return render(<CloudSyncScreen />);
}
beforeEach(() => {
  jest.clearAllMocks();
  mockState = { phase: 'ready', mode: 'guest', userId: null, revision: 0 };
  jest.mocked(engine.status).mockReset().mockResolvedValue({
    signedIn: true,
    userId: 'account-a',
    sessionError: '',
    cursor: 0,
    pending: 0,
    failed: 0,
    conflict: 0,
    conflicts: [],
  });
  jest
    .mocked(engine.backupStatus)
    .mockReset()
    .mockResolvedValue({ latest: null, lastSuccessful: null });
  jest.mocked(engine.createBackup).mockReset();
  setLanguage('en');
});

const completedAtUtc = new Date().toISOString();
const backup: BackupMetadata = {
  id: '11111111-1111-1111-1111-111111111111',
  status: 'Completed',
  formatVersion: 1,
  createdAtUtc: completedAtUtc,
  completedAtUtc,
  expiresAtUtc: new Date(Date.parse(completedAtUtc) + 7 * 86_400_000).toISOString(),
  retentionDays: 7,
  syncVersion: 4,
  sizeBytes: 1000,
  failureCode: null,
  isExpired: false,
  canRestore: false,
};

test('Cloud sync loads owned backup metadata once and shows local timestamps and remaining retention', async () => {
  jest.mocked(engine.backupStatus).mockResolvedValue({ latest: backup, lastSuccessful: backup });
  authenticated();
  expect(await screen.findByText('Backup completed')).toBeTruthy();
  expect(
    screen.getByText(
      `Last successful backup: ${new Date(completedAtUtc).toLocaleString('en')} (local time)`,
    ),
  ).toBeTruthy();
  expect(
    screen.getByText(`Expires: ${new Date(backup.expiresAtUtc).toLocaleString('en')} (local time)`),
  ).toBeTruthy();
  expect(screen.getByText(/Retention remaining: up to/)).toBeTruthy();
  expect(engine.backupStatus).toHaveBeenCalledTimes(1);
  expect(engine.createBackup).not.toHaveBeenCalled();
});

test.each(['en', 'fa'] as const)(
  'empty backup status and manual action are localized in %s',
  async (language) => {
    setLanguage(language);
    authenticated();
    await screen.findByText(translate(language, 'backup.never'));
    expect(screen.getByRole('button', { name: translate(language, 'backup.now') })).toBeTruthy();
  },
);

test('manual backup waits for backend verification, blocks duplicates and refreshes status', async () => {
  let finish!: (value: Awaited<ReturnType<typeof engine.createBackup>>) => void;
  jest.mocked(engine.createBackup).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  authenticated();
  await screen.findByText('Never backed up');
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  expect(engine.createBackup).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Backup in progress')).toBeTruthy();
  expect(screen.queryByText('The server confirmed and verified the backup.')).toBeNull();
  jest.mocked(engine.backupStatus).mockResolvedValue({ latest: backup, lastSuccessful: backup });
  await act(async () => finish(backup as Awaited<ReturnType<typeof engine.createBackup>>));
  await screen.findByText('The server confirmed and verified the backup.');
  expect(screen.getByText('Backup completed')).toBeTruthy();
  expect(engine.backupStatus).toHaveBeenCalledTimes(2);
});

test('failed manual backup preserves the last successful metadata and can be retried', async () => {
  jest.mocked(engine.backupStatus).mockResolvedValue({ latest: backup, lastSuccessful: backup });
  jest.mocked(engine.createBackup).mockRejectedValueOnce(new CloudError(0));
  authenticated();
  await screen.findByText('Backup completed');
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  await screen.findByText('Backup failed');
  expect(screen.getByText(/The server cannot be reached/)).toBeTruthy();
  expect(screen.getByText(/Last successful backup:/)).toBeTruthy();
  expect(screen.queryByText('The server confirmed and verified the backup.')).toBeNull();
  jest
    .mocked(engine.createBackup)
    .mockResolvedValue(backup as Awaited<ReturnType<typeof engine.createBackup>>);
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  await screen.findByText('The server confirmed and verified the backup.');
  expect(engine.createBackup).toHaveBeenCalledTimes(2);
});

test('backup capacity errors explain the operational cleanup dependency rather than a sync conflict', async () => {
  jest
    .mocked(engine.createBackup)
    .mockRejectedValueOnce(new CloudError(409, undefined, undefined, 'backup_capacity_reached'));
  authenticated();
  await screen.findByText('Never backed up');
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  await screen.findByText(/Stored backup capacity is reached/);
  expect(screen.getByText('Backup failed')).toBeTruthy();
});

test('an explicit status refresh resolves an uncertain failed operation using actual server completion', async () => {
  jest.mocked(engine.createBackup).mockRejectedValueOnce(new CloudError(0));
  authenticated();
  await screen.findByText('Never backed up');
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  await screen.findByText('Backup failed');
  jest
    .mocked(engine.backupStatus)
    .mockResolvedValueOnce({ latest: backup, lastSuccessful: backup });
  fireEvent.press(screen.getByRole('button', { name: 'Refresh backup status' }));
  await screen.findByText('Backup completed');
  expect(screen.queryByText('Backup failed')).toBeNull();
  expect(screen.queryByText('The server confirmed and verified the backup.')).toBeNull();
  expect(engine.createBackup).toHaveBeenCalledTimes(1);
});

test.each([
  [0, 'backup.networkError'],
  [401, 'backup.authError'],
  [429, 'backup.rateError'],
  [503, 'backup.unavailable'],
  [413, 'backup.sizeError'],
] as const)(
  'status failure %s is unconfirmed with an actionable error and refresh',
  async (status, key) => {
    jest.mocked(engine.backupStatus).mockRejectedValueOnce(new CloudError(status));
    authenticated();
    await screen.findByText(translate('en', key));
    expect(screen.getByText('Server backup status is unconfirmed.')).toBeTruthy();
    expect(screen.queryByText('Never backed up')).toBeNull();
    expect(screen.queryByText('Backup completed')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Refresh backup status' }));
    await screen.findByText('Never backed up');
    expect(engine.backupStatus).toHaveBeenCalledTimes(2);
  },
);

test('expired latest backup is not reported as a retained completed backup', async () => {
  const expired = {
    ...backup,
    status: 'Expired' as const,
    isExpired: true,
    createdAtUtc: '2020-01-01T00:00:00Z',
    completedAtUtc: '2020-01-01T00:00:00Z',
    expiresAtUtc: '2020-01-08T00:00:00Z',
  };
  jest.mocked(engine.backupStatus).mockResolvedValue({ latest: expired, lastSuccessful: null });
  authenticated();
  await waitFor(() =>
    expect(screen.getAllByText('Backup expired — create a new backup.').length).toBeGreaterThan(0),
  );
  expect(screen.queryByText('Backup completed')).toBeNull();
  expect(screen.getByText(/Last successful backup:/)).toBeTruthy();
});

test.each(['Pending', 'Failed'] as const)(
  'backend %s status is displayed without a success claim',
  async (status) => {
    jest.mocked(engine.backupStatus).mockResolvedValue({
      latest: {
        ...backup,
        status,
        completedAtUtc: null,
        sizeBytes: null,
        syncVersion: null,
        failureCode: status === 'Failed' ? 'backup_storage_failed' : null,
      },
      lastSuccessful: null,
    });
    authenticated();
    await screen.findByText(status === 'Pending' ? 'Backup in progress' : 'Backup failed');
    expect(screen.queryByText('Backup completed')).toBeNull();
  },
);

test('logout removes backup metadata immediately and ignores a late account response', async () => {
  let finish!: (value: BackupOverview) => void;
  jest.mocked(engine.backupStatus).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  authenticated();
  update({ phase: 'ready', mode: 'guest', userId: null, revision: 2 });
  await act(async () => finish({ latest: backup, lastSuccessful: backup }));
  expect(screen.queryByTestId('settings-backup-card')).toBeNull();
  expect(screen.queryByText(/Last successful backup:/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
});

test('switching accounts never reuses the previous backup metadata', async () => {
  jest
    .mocked(engine.backupStatus)
    .mockResolvedValueOnce({ latest: backup, lastSuccessful: backup });
  authenticated();
  await screen.findByText('Backup completed');
  update({ phase: 'ready', mode: 'account', userId: 'account-b', revision: 2 });
  expect(screen.queryByText(/Last successful backup:/)).toBeNull();
  await screen.findByText('Never backed up');
  expect(engine.backupStatus).toHaveBeenCalledTimes(2);
});

test('logout during manual backup ignores its late result and never refreshes metadata as a guest', async () => {
  let finish!: (value: Awaited<ReturnType<typeof engine.createBackup>>) => void;
  jest.mocked(engine.createBackup).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  authenticated();
  await screen.findByText('Never backed up');
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  update({ phase: 'ready', mode: 'guest', userId: null, revision: 2 });
  await act(async () => finish(backup as Awaited<ReturnType<typeof engine.createBackup>>));
  expect(screen.queryByTestId('settings-backup-card')).toBeNull();
  expect(screen.queryByText('The server confirmed and verified the backup.')).toBeNull();
  expect(engine.backupStatus).toHaveBeenCalledTimes(1);
});

test('metadata refresh failure after a verified manual backup does not invent a failed creation', async () => {
  jest
    .mocked(engine.createBackup)
    .mockResolvedValue(backup as Awaited<ReturnType<typeof engine.createBackup>>);
  authenticated();
  await screen.findByText('Never backed up');
  jest.mocked(engine.backupStatus).mockRejectedValueOnce(new CloudError(0));
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  await screen.findByText('The server confirmed and verified the backup.');
  expect(screen.getByText('Backup completed')).toBeTruthy();
  expect(screen.queryByText(/The server cannot be reached/)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(await screen.findByText(/The server cannot be reached/)).toBeTruthy();
  expect(screen.getAllByTestId('feedback-modal')).toHaveLength(1);
});
