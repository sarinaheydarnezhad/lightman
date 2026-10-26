import { act, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { StorageState } from '@/core/storage/local-storage-scopes';
import { DataScopeBoundary } from './data-scope-boundary';

let mockState: StorageState = { phase: 'ready', mode: 'account', userId: 'account', revision: 1 };
const mockListeners = new Set<() => void>();
jest.mock('@/features/auth/presentation/guest-data-screen', () => {
  const MockText = jest.requireActual<typeof import('react-native')>('react-native').Text;
  return { GuestDataScreen: () => <MockText>Guest decision modal</MockText> };
});
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), dismissAll: jest.fn() },
  usePathname: () => '/settings',
}));
jest.mock('@/core/composition/repositories', () => ({
  storageScopes: {
    snapshot: () => mockState,
    subscribe: (listener: () => void) => {
      mockListeners.add(listener);
      return () => mockListeners.delete(listener);
    },
    enterGuest: jest.fn(async () => {}),
  },
}));

function ScopedScreen() {
  const [name] = useState(() =>
    mockState.mode === 'account' ? 'Private account deck' : 'Guest deck',
  );
  return <Text>{name}</Text>;
}

function update(state: StorageState) {
  act(() => {
    mockState = state;
    mockListeners.forEach((listener) => listener());
  });
}

test('scope changes hide account screens while opening storage and discard cached account UI before guest mode', () => {
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 850 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <DataScopeBoundary>
        <ScopedScreen />
      </DataScopeBoundary>
    </SafeAreaProvider>,
  );
  expect(screen.getByText('Private account deck')).toBeTruthy();
  expect(screen.queryByText(/Account mode.*Offline data available.*Free plan/)).toBeNull();
  update({ ...mockState, phase: 'loading', revision: 2 });
  expect(screen.queryByText('Private account deck')).toBeNull();
  update({ phase: 'ready', mode: 'guest', userId: null, revision: 2 });
  expect(router.dismissAll).toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/(tabs)/settings');
  expect(screen.getByText('Guest deck')).toBeTruthy();
  expect(screen.queryByText(/Guest mode.*Local data only.*Free plan/)).toBeNull();
  expect(screen.queryByText('Private account deck')).toBeNull();
  update({ ...mockState, phase: 'error', revision: 3 });
  expect(screen.queryByText('Guest deck')).toBeNull();
  expect(
    screen.getByText('Your data has not been deleted. Retry opening guest storage.'),
  ).toBeTruthy();
});

test('account entry stays gated until credentials are saved and the guest decision is resolved', () => {
  mockState = {
    phase: 'ready',
    mode: 'account',
    userId: 'account',
    revision: 4,
    accountEntry: 'authenticating',
  };
  render(
    <DataScopeBoundary>
      <ScopedScreen />
    </DataScopeBoundary>,
  );
  expect(screen.queryByText('Private account deck')).toBeNull();
  expect(screen.queryByText('Guest decision modal')).toBeNull();
  update({ ...mockState, accountEntry: 'review' });
  expect(screen.getByText('Guest decision modal')).toBeTruthy();
  expect(screen.queryByText('Private account deck')).toBeNull();
  update({ ...mockState, accountEntry: undefined });
  expect(screen.queryByText('Guest decision modal')).toBeNull();
  expect(screen.getByText('Private account deck')).toBeTruthy();
});
