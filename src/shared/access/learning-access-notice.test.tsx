import { act, render, screen, waitFor } from '@testing-library/react-native';
import * as Network from 'expo-network';
import { AppState } from 'react-native';
import { LearningAccessController } from '@/core/access/learning-access';
import type { Entitlements } from '@/core/sync/subscription';
import { LearningAccessNotice } from './learning-access-notice';

let mockAccess: LearningAccessController;
jest.mock('@/core/composition/learning-access', () => ({ learningAccess: () => mockAccess }));
jest.mock('expo-network', () => ({
  NetworkStateType: { WIFI: 'WIFI' },
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

function free(): Entitlements {
  return {
    currentPlan: 'Free',
    isActive: false,
    startsAtUtc: null,
    expiresAtUtc: null,
    features: { unlimitedDecks: false, unlimitedCards: false },
    limits: { decks: 1, cards: 50 },
    isPurchasable: false,
    purchaseSupported: false,
    withinFreeTierLimits: false,
    usage: { decks: 2, cards: 51 },
    validatedAtUtc: new Date().toISOString(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(AppState.addEventListener).mockReturnValue({ remove: jest.fn() });
});

test('polling pauses offline and in the background, resumes with jitter, and cleans up', async () => {
  jest.useFakeTimers();
  const originalPhase = Object.getOwnPropertyDescriptor(AppState, 'currentState')!;
  const setPhase = (value: string) =>
    Object.defineProperty(AppState, 'currentState', { configurable: true, writable: true, value });
  setPhase('active');
  const foreground = jest.mocked(AppState.addEventListener);
  try {
    mockAccess = new LearningAccessController({
      userId: 'owner',
      usage: async () => ({ decks: 0, cards: 0 }),
    });
    const refresh = jest.spyOn(mockAccess, 'refreshIfStale').mockResolvedValue(undefined);
    const view = render(<LearningAccessNotice />);
    const networkChange = jest.mocked(Network.addNetworkStateListener).mock.calls[0]![0];
    const appChange = foreground.mock.calls[0]![1];
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() =>
      networkChange({
        type: Network.NetworkStateType.WIFI,
        isConnected: false,
        isInternetReachable: false,
      }),
    );
    await act(() => jest.advanceTimersByTimeAsync(10 * 60_000));
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() =>
      networkChange({
        type: Network.NetworkStateType.WIFI,
        isConnected: true,
        isInternetReachable: true,
      }),
    );
    expect(refresh).toHaveBeenCalledTimes(2);
    setPhase('background');
    act(() => appChange('background'));
    await act(() => jest.advanceTimersByTimeAsync(10 * 60_000));
    expect(refresh).toHaveBeenCalledTimes(2);
    setPhase('active');
    act(() => appChange('active'));
    expect(refresh).toHaveBeenCalledTimes(3);
    await act(() => jest.advanceTimersByTimeAsync(5 * 60_000));
    expect(refresh).toHaveBeenCalledTimes(4);
    view.unmount();
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    Object.defineProperty(AppState, 'currentState', originalPhase);
    jest.useRealTimers();
  }
});

test.each([
  ['deck', 1, 50],
  ['card', 1, 50],
  ['study', 2, 51],
] as const)(
  '%s restrictions never render a global error banner',
  async (operation, decks, cards) => {
    mockAccess = new LearningAccessController({
      userId: null,
      usage: async () => ({ decks, cards }),
    });
    const view = render(<LearningAccessNotice />);
    await act(async () => {
      await expect(mockAccess.assertAllowed(operation)).rejects.toMatchObject({
        code: 'free-tier-limit',
      });
    });
    expect(view.toJSON()).toBeNull();
    expect(Network.addNetworkStateListener).not.toHaveBeenCalled();
  },
);

test('account access still refreshes without displaying a top-of-screen notice', async () => {
  const fetch = jest.fn(async () => free());
  mockAccess = new LearningAccessController({
    userId: 'owner',
    usage: async () => ({ decks: 2, cards: 51 }),
    online: async () => true,
    fetch,
  });
  const view = render(<LearningAccessNotice />);
  await waitFor(() => expect(mockAccess.snapshot().restriction?.decks).toBe(true));
  expect(fetch).toHaveBeenCalled();
  expect(Network.addNetworkStateListener).toHaveBeenCalled();
  expect(view.toJSON()).toBeNull();
  expect(screen.queryByTestId('learning-access-notice')).toBeNull();
});

test('offline access errors do not render a global banner', async () => {
  mockAccess = new LearningAccessController({
    userId: 'owner',
    usage: async () => ({ decks: 0, cards: 0 }),
    online: async () => false,
  });
  const view = render(<LearningAccessNotice />);
  await waitFor(() => expect(mockAccess.snapshot().message).not.toBeNull());
  expect(view.toJSON()).toBeNull();
});
