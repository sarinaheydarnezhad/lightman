import { act, render, screen, waitFor } from '@testing-library/react-native';
import * as Network from 'expo-network';
import { LearningAccessController } from '@/core/access/learning-access';
import type { Entitlements } from '@/core/sync/subscription';
import { LearningAccessNotice } from './learning-access-notice';

let mockAccess: LearningAccessController;
jest.mock('@/core/composition/learning-access', () => ({ learningAccess: () => mockAccess }));
jest.mock('expo-network', () => ({
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

beforeEach(() => jest.clearAllMocks());

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
