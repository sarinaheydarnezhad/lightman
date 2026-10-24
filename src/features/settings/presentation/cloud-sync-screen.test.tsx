import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { syncEngine } from '@/core/composition/sync';
import { CloudSyncScreen } from './cloud-sync-screen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => void) => {
    const react = jest.requireActual<typeof import('react')>('react');
    react.useEffect(effect, [effect]);
  },
}));
jest.mock('@/core/composition/application', () => ({ application: {} }));
jest.mock('@/core/composition/repositories', () => ({
  storageScopes: { snapshot: () => ({ mode: 'account' }) },
}));
jest.mock('@/core/composition/sync', () => ({
  syncEngine: {
    available: true,
    status: jest.fn(),
    resolve: jest.fn(),
    retryFailed: jest.fn(),
    syncNow: jest.fn(),
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
  jest.clearAllMocks();
  jest.mocked(engine.status).mockReset().mockResolvedValue(status);
  jest.mocked(engine.resolve).mockReset().mockResolvedValue(undefined);
  jest.mocked(engine.retryFailed).mockReset().mockResolvedValue(undefined);
  jest.mocked(engine.syncNow).mockReset().mockResolvedValue(undefined);
});

test('failed changes and conflict resolution are queued in modals, not shown inline', async () => {
  jest.mocked(engine.status).mockResolvedValue({ ...status, failed: 2, conflicts: [conflict] });
  render(<CloudSyncScreen />);
  expect(await screen.findByText('2 changes need manual retry.')).toBeTruthy();
  expect(screen.getAllByTestId('feedback-modal')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Use server version' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByText('2 changes need manual retry.')).toBeNull();
  expect(screen.getByRole('button', { name: 'Use server version' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByTestId('feedback-modal')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Use server version' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Conflict: card card-id' }));
  expect(screen.getByTestId('feedback-modal')).toBeTruthy();
  jest.mocked(engine.status).mockResolvedValue(status);
  fireEvent.press(screen.getByRole('button', { name: 'Keep my edit (retry)' }));
  await waitFor(() => expect(engine.resolve).toHaveBeenCalledWith('operation', 'local'));
  await waitFor(() => expect(screen.queryByTestId('feedback-modal')).toBeNull());
});

test('archived conflicts explain deletion inside the modal and cannot keep local edits', async () => {
  jest.mocked(engine.status).mockResolvedValue({
    ...status,
    conflicts: [{ ...conflict, archived: true }],
  });
  render(<CloudSyncScreen />);
  expect(await screen.findByTestId('feedback-modal')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Keep my edit (retry)' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Use server version' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('button', { name: 'Use server version' })).toBeNull();
});

test('retry remains available after dismissing a failure notice', async () => {
  jest.mocked(engine.status).mockResolvedValue({ ...status, failed: 1 });
  render(<CloudSyncScreen />);
  await screen.findByTestId('feedback-modal');
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  jest.mocked(engine.status).mockResolvedValue(status);
  fireEvent.press(screen.getByRole('button', { name: 'Retry failed changes' }));
  await waitFor(() => expect(engine.retryFailed).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Retry failed changes' })).toBeNull(),
  );
});

test('the same operation error can appear again after dismissal', async () => {
  jest.mocked(engine.syncNow).mockRejectedValue(new Error('Connection failed.'));
  render(<CloudSyncScreen />);
  fireEvent.press(await screen.findByRole('button', { name: 'Sync now' }));
  expect(await screen.findByText('Connection failed.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByText('Connection failed.')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
  expect(await screen.findByText('Connection failed.')).toBeTruthy();
  expect(engine.syncNow).toHaveBeenCalledTimes(2);
});

test('resolution failures open an error modal after closing the conflict modal', async () => {
  jest.mocked(engine.status).mockResolvedValue({ ...status, conflicts: [conflict] });
  jest.mocked(engine.resolve).mockRejectedValue(new Error('Could not resolve conflict.'));
  render(<CloudSyncScreen />);
  fireEvent.press(await screen.findByRole('button', { name: 'Use server version' }));
  expect(await screen.findByText('Could not resolve conflict.')).toBeTruthy();
  expect(screen.getAllByTestId('feedback-modal')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Use server version' })).toBeNull();
});
