import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { syncEngine } from '@/core/composition/sync';
import { CloudSyncScreen } from './cloud-sync-screen';
import { CloudError } from '@/core/sync/cloud-client';

const mockScope = { phase: 'ready', mode: 'account', userId: 'account', revision: 1 };

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => void) => {
    const react = jest.requireActual<typeof import('react')>('react');
    react.useEffect(effect, [effect]);
  },
}));
jest.mock('@/core/composition/application', () => ({ application: {} }));
jest.mock('@/core/composition/repositories', () => ({
  storageScopes: { snapshot: () => mockScope, subscribe: () => () => {} },
}));
jest.mock('@/core/composition/sync', () => ({
  syncEngine: {
    available: true,
    status: jest.fn(),
    resolve: jest.fn(),
    retryFailed: jest.fn(),
    syncNow: jest.fn(),
    backupStatus: jest.fn(),
    createBackup: jest.fn(),
  },
}));

const engine = syncEngine!;
const status: Awaited<ReturnType<typeof engine.status>> = {
  userId: 'account',
  cursor: 0,
  signedIn: true,
  sessionError: '',
  pending: 0,
  failed: 0,
  conflict: 0,
  conflicts: [],
};
const conflict = {
  operationId: 'operation',
  entityType: 'card',
  entityId: 'card-id',
  serverVersion: 2,
  archived: false,
};

beforeEach(() => {
  Object.assign(mockScope, { phase: 'ready', mode: 'account', userId: 'account', revision: 1 });
  jest.clearAllMocks();
  jest.mocked(engine.status).mockReset().mockResolvedValue(status);
  jest.mocked(engine.resolve).mockReset().mockResolvedValue(undefined);
  jest.mocked(engine.retryFailed).mockReset().mockResolvedValue(undefined);
  jest.mocked(engine.syncNow).mockReset().mockResolvedValue(undefined);
  jest
    .mocked(engine.backupStatus)
    .mockReset()
    .mockResolvedValue({ latest: null, lastSuccessful: null });
});

test('a late status response cannot populate another account screen', async () => {
  let finish!: (value: typeof status) => void;
  jest.mocked(engine.status).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const view = render(<CloudSyncScreen />);
  await waitFor(() => expect(engine.status).toHaveBeenCalledTimes(1));
  Object.assign(mockScope, { userId: 'other-account', revision: 2 });
  jest.mocked(engine.status).mockResolvedValue({ ...status, userId: 'other-account', pending: 2 });
  view.rerender(<CloudSyncScreen />);
  await screen.findByText('Changes waiting to sync: 2');
  await act(async () => finish({ ...status, pending: 99, conflicts: [conflict] }));
  expect(screen.queryByText('Changes waiting to sync: 99')).toBeNull();
  expect(screen.queryByText('Conflict: card card-id')).toBeNull();
  expect(screen.getByText('Changes waiting to sync: 2')).toBeTruthy();
  expect(engine.resolve).not.toHaveBeenCalled();
});

test('repeated sync taps do not overlap a pending operation or enable conflict resolution', async () => {
  let finish!: () => void;
  jest.mocked(engine.status).mockResolvedValue({ ...status, conflicts: [conflict] });
  jest.mocked(engine.syncNow).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(<CloudSyncScreen />);
  const sync = await screen.findByRole('button', { name: 'Sync now' });
  fireEvent.press(sync);
  fireEvent.press(sync);
  expect(engine.syncNow).toHaveBeenCalledTimes(1);
  const resolve = screen.getByRole('button', { name: 'Use server version' });
  expect(resolve).toBeDisabled();
  fireEvent.press(resolve);
  expect(engine.resolve).not.toHaveBeenCalled();
  await act(async () => finish());
  expect(screen.getByRole('button', { name: 'Use server version' })).not.toBeDisabled();
});

test('failed changes and conflict choices remain visible together until verified recovery', async () => {
  jest.mocked(engine.status).mockResolvedValue({ ...status, failed: 2, conflicts: [conflict] });
  render(<CloudSyncScreen />);
  expect(await screen.findByText('2 changes need manual retry.')).toBeTruthy();
  expect(screen.queryByTestId('feedback-modal')).toBeNull();
  expect(screen.getByRole('button', { name: 'Retry failed changes' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Use server version' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  jest.mocked(engine.status).mockResolvedValue(status);
  fireEvent.press(screen.getByRole('button', { name: 'Keep my edit (retry)' }));
  await waitFor(() => expect(engine.resolve).toHaveBeenCalledWith('operation', 'local'));
  await waitFor(() => expect(screen.queryByText('Conflict: card card-id')).toBeNull());
  expect(screen.queryByRole('button', { name: 'Retry failed changes' })).toBeNull();
});

test('deleted conflicts keep their explanation and cannot keep local edits', async () => {
  jest.mocked(engine.status).mockResolvedValue({
    ...status,
    conflicts: [{ ...conflict, archived: true }],
  });
  render(<CloudSyncScreen />);
  expect(await screen.findByText(/Deleted on another device/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Keep my edit (retry)' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Use server version' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
});

test('retry remains available until failed changes are recovered', async () => {
  jest.mocked(engine.status).mockResolvedValue({ ...status, failed: 1 });
  render(<CloudSyncScreen />);
  await screen.findByText('1 changes need manual retry.');
  jest.mocked(engine.status).mockResolvedValue(status);
  fireEvent.press(screen.getByRole('button', { name: 'Retry failed changes' }));
  await waitFor(() => expect(engine.retryFailed).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Retry failed changes' })).toBeNull(),
  );
});

test('unknown errors do not expose diagnostics and a later explicit attempt can recover', async () => {
  jest.mocked(engine.syncNow).mockRejectedValue(new Error('Connection failed.'));
  render(<CloudSyncScreen />);
  fireEvent.press(await screen.findByRole('button', { name: 'Sync now' }));
  expect(
    await screen.findByText('Unable to synchronize. Your offline changes are safe.'),
  ).toBeTruthy();
  expect(screen.queryByText('Connection failed.')).toBeNull();
  jest.mocked(engine.syncNow).mockResolvedValueOnce(undefined);
  fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
  await waitFor(() => expect(engine.syncNow).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.queryByText('Unable to synchronize. Your offline changes are safe.')).toBeNull(),
  );
});

test('a request deadline uses the existing localized synchronization message', async () => {
  jest
    .mocked(engine.syncNow)
    .mockRejectedValue(new CloudError(0, undefined, undefined, 'request_timeout'));
  render(<CloudSyncScreen />);
  fireEvent.press(await screen.findByRole('button', { name: 'Sync now' }));
  expect(
    await screen.findByText('Unable to synchronize. Your offline changes are safe.'),
  ).toBeTruthy();
});

test('resolution failures keep conflict choices and recovery visible without losing operation identity', async () => {
  jest.mocked(engine.status).mockResolvedValue({ ...status, conflicts: [conflict] });
  jest.mocked(engine.resolve).mockRejectedValue(new Error('Could not resolve conflict.'));
  render(<CloudSyncScreen />);
  fireEvent.press(await screen.findByRole('button', { name: 'Use server version' }));
  expect(
    await screen.findByText('Unable to synchronize. Your offline changes are safe.'),
  ).toBeTruthy();
  expect(screen.queryByText('Could not resolve conflict.')).toBeNull();
  expect(screen.getByRole('button', { name: 'Use server version' })).toBeTruthy();
  expect(engine.resolve).toHaveBeenCalledWith('operation', 'server');
  expect(screen.queryByTestId('feedback-modal')).toBeNull();
});
