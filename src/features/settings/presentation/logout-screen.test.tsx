import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { syncEngine } from '@/core/composition/sync';
import type { StorageState } from '@/core/storage/local-storage-scopes';
import type { LogoutResult } from '@/core/sync/logout-journal';
import { LogoutScreen } from './logout-screen';
import { LogoutNotice } from '@/features/auth/presentation/logout-notice';

let mockScope: StorageState = { phase: 'ready', mode: 'account', userId: 'account', revision: 1 };
let mockResult: LogoutResult | null = null;
jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock('@/core/composition/application', () => ({ application: {} }));
jest.mock('@/core/composition/repositories', () => ({
  storageScopes: { snapshot: () => mockScope, subscribe: () => () => {} },
}));
jest.mock('@/core/composition/sync', () => ({
  syncEngine: {
    available: true,
    signOut: jest.fn(),
    subscribeLogout: () => () => {},
    logoutSnapshot: () => mockResult,
  },
}));
const engine = syncEngine!;
const result: LogoutResult = {
  synchronized: false,
  serverRevoked: false,
  credentialsCleared: true,
  retryAvailable: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockScope = { phase: 'ready', mode: 'account', userId: 'account', revision: 1 };
  mockResult = null;
  Object.defineProperty(engine, 'available', { value: true, configurable: true });
  jest.mocked(engine.signOut).mockReset().mockResolvedValue(result);
});

function mount(content = <LogoutScreen />) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      {content}
    </SafeAreaProvider>,
  );
}

test('logout confirmation presents explicit choices and cancellation changes no data', () => {
  mount();
  expect(screen.getByRole('button', { name: 'Back Up and Log Out' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Log Out Without Backing Up' })).toBeTruthy();
  expect(screen.getByText(/No backup retention period/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(engine.signOut).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/settings');
});

test('verified backup choice shows progress, blocks duplicate submissions and then returns to settings', async () => {
  let finish!: (value: LogoutResult) => void;
  jest.mocked(engine.signOut).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  mount();
  fireEvent.press(screen.getByRole('button', { name: 'Back Up and Log Out' }));
  fireEvent.press(screen.getByRole('button', { name: 'Back Up and Log Out' }));
  expect(engine.signOut).toHaveBeenCalledTimes(1);
  expect(engine.signOut).toHaveBeenCalledWith(true);
  expect(screen.getByText(/Synchronizing and verifying/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => {
    finish({ ...result, synchronized: true, serverRevoked: true });
  });
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/settings');
});

test('backup failure makes no success claim; proceeding requires the explicit without-backup action', async () => {
  jest.mocked(engine.signOut).mockRejectedValueOnce(new Error('Network unavailable'));
  mount();
  fireEvent.press(screen.getByRole('button', { name: 'Back Up and Log Out' }));
  expect(await screen.findByText(/No backup is claimed/)).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
  expect(mockScope.mode).toBe('account');
  fireEvent.press(screen.getByRole('button', { name: 'Log Out Without Backing Up' }));
  await waitFor(() => expect(engine.signOut).toHaveBeenLastCalledWith(false));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(tabs)/settings'));
});

test('unavailable sync is disclosed and logout without backup remains available', async () => {
  Object.defineProperty(engine, 'available', { value: false, configurable: true });
  mount();
  expect(screen.getByText(/Verified server sync is unavailable/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Back Up and Log Out' }));
  expect(engine.signOut).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Log Out Without Backing Up' }));
  await waitFor(() => expect(engine.signOut).toHaveBeenCalledWith(false));
});

test('offline logout notice states uncertainty rather than claiming server revocation or backup', () => {
  mockResult = result;
  mount(<LogoutNotice />);
  expect(screen.getByText(/Only guest data is accessible/)).toBeTruthy();
  expect(screen.getByText(/without creating or verifying a backup/)).toBeTruthy();
  expect(screen.getByText(/Server revocation is unconfirmed/)).toBeTruthy();
  expect(screen.queryByText('The server confirmed session revocation.')).toBeNull();
});

test('guest deep-link exposes no authenticated actions and offers login', () => {
  mockScope = { phase: 'ready', mode: 'guest', userId: null, revision: 2 };
  mount();
  expect(screen.queryByRole('button', { name: 'Back Up and Log Out' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(router.replace).toHaveBeenCalledWith('/auth');
  expect(engine.signOut).not.toHaveBeenCalled();
});
