import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { guestTransfer } from '@/core/composition/guest-transfer';
import { syncEngine } from '@/core/composition/sync';
import type { TransferPreview } from '@/core/sync/guest-transfer';
import { GuestDataScreen } from './guest-data-screen';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock('@/core/composition/application', () => ({ application: {} }));
jest.mock('@/core/composition/guest-transfer', () => ({
  guestTransfer: { preview: jest.fn(), transfer: jest.fn() },
}));
jest.mock('@/core/composition/sync', () => ({
  syncEngine: { available: true, createBackup: jest.fn() },
}));

const service = guestTransfer!;
const preview: TransferPreview = {
  scenario: 'guest-only',
  guest: [{ id: 'guest', name: 'Words', cards: 2 }],
  account: [],
  reviewEvents: 3,
  sameNames: [],
  blockers: [],
  token: 'preview',
  journal: null,
  accountVerified: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(service.preview).mockReset().mockResolvedValue(preview);
  jest.mocked(service.transfer).mockReset().mockResolvedValue();
  jest.mocked(syncEngine!.createBackup).mockReset();
});

function mount() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <GuestDataScreen />
    </SafeAreaProvider>,
  );
}

test('guest-only preview requires explicit confirmation and cancellation never copies', async () => {
  mount();
  await screen.findByText('Words · 2 cards');
  expect(service.transfer).not.toHaveBeenCalled();
  expect(syncEngine!.createBackup).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Add guest decks as separate copies' }));
  fireEvent.press(screen.getByRole('button', { name: 'Cancel without copying' }));
  expect(service.transfer).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Keep datasets separate' }));
  expect(router.replace).toHaveBeenCalledWith('/');
});

test('optional account backup must verify before copying; failure blocks transfer until explicit retry', async () => {
  jest.mocked(service.preview).mockResolvedValue({
    ...preview,
    scenario: 'both',
    account: [{ id: 'account', name: 'Account', cards: 1 }],
  });
  jest
    .mocked(syncEngine!.createBackup)
    .mockRejectedValueOnce(new Error('Server backup could not be verified'));
  mount();
  fireEvent.press(
    await screen.findByRole('button', { name: 'Add guest decks as separate copies' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Account and Confirm Copy' }));
  await screen.findByText('Server backup could not be verified');
  expect(service.transfer).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
  let complete!: () => void;
  jest.mocked(syncEngine!.createBackup).mockImplementationOnce(async () => {
    await new Promise<void>((resolve) => {
      complete = resolve;
    });
    return {} as Awaited<ReturnType<NonNullable<typeof syncEngine>['createBackup']>>;
  });
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Account and Confirm Copy' }));
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Account and Confirm Copy' }));
  await screen.findByText(/Synchronizing account data, creating and verifying/);
  expect(syncEngine!.createBackup).toHaveBeenCalledTimes(2);
  expect(service.transfer).not.toHaveBeenCalled();
  await act(async () => complete());
  await waitFor(() => expect(service.transfer).toHaveBeenCalledTimes(1));
  expect(service.transfer).toHaveBeenCalledWith(
    expect.objectContaining({ scenario: 'both' }),
    expect.any(Function),
  );
});

test('cancelling after backup failure changes neither dataset and does not retry automatically', async () => {
  jest.mocked(service.preview).mockResolvedValue({
    ...preview,
    scenario: 'both',
    account: [{ id: 'account', name: 'Account', cards: 1 }],
  });
  jest.mocked(syncEngine!.createBackup).mockRejectedValueOnce(new Error('Backup offline'));
  mount();
  fireEvent.press(
    await screen.findByRole('button', { name: 'Add guest decks as separate copies' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Account and Confirm Copy' }));
  await screen.findByText('Backup offline');
  fireEvent.press(screen.getByRole('button', { name: 'Cancel without copying' }));
  expect(service.transfer).not.toHaveBeenCalled();
  expect(syncEngine!.createBackup).toHaveBeenCalledTimes(1);
});

test('an explicitly confirmed additive transfer does not require a backup or enable replacement', async () => {
  jest.mocked(service.preview).mockResolvedValue({
    ...preview,
    scenario: 'both',
    account: [{ id: 'account', name: 'Account', cards: 1 }],
    sameNames: ['Words'],
  });
  mount();
  fireEvent.press(
    await screen.findByRole('button', { name: 'Add guest decks as separate copies' }),
  );
  expect(screen.getByText(/Replacement and destructive merging are not supported/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Confirm copy to account' }));
  await waitFor(() => expect(service.transfer).toHaveBeenCalledTimes(1));
  expect(syncEngine!.createBackup).not.toHaveBeenCalled();
});

test('both datasets preview same-name decks as different contents and quota blocker offers separation only', async () => {
  jest.mocked(service.preview).mockResolvedValue({
    ...preview,
    scenario: 'both',
    account: [{ id: 'account', name: 'Words', cards: 5 }],
    sameNames: ['Words'],
    blockers: ['The free plan allows 1 active deck.'],
  });
  mount();
  await screen.findByText('Words · 5 cards');
  expect(screen.getByText(/Matching titles do not mean matching cards/)).toBeTruthy();
  expect(screen.getByText('Words · 2 cards')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Add guest decks as separate copies' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Keep datasets separate' }));
  expect(service.transfer).not.toHaveBeenCalled();
});

test.each(['account-only', 'empty'] as const)(
  '%s provides completion without initiating a guest copy',
  async (scenario) => {
    jest.mocked(service.preview).mockResolvedValue({
      ...preview,
      scenario,
      guest: [],
      account: scenario === 'account-only' ? [{ id: 'account', name: 'Account', cards: 1 }] : [],
    });
    mount();
    await screen.findByRole('button', { name: 'Continue to account' });
    expect(screen.queryByRole('button', { name: 'Add guest decks as separate copies' })).toBeNull();
    expect(service.transfer).not.toHaveBeenCalled();
  },
);

test('progress disables duplicate submissions and only verified completion displays success', async () => {
  let finish: () => void = () => {};
  jest.mocked(service.transfer).mockImplementation(async (_preview, progress) => {
    progress?.({ acknowledged: 2, total: 5 });
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  mount();
  fireEvent.press(
    await screen.findByRole('button', { name: 'Add guest decks as separate copies' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Confirm copy to account' }));
  await screen.findByText('Verified acknowledgements: 2 / 5. Checking server data…');
  fireEvent.press(screen.getByRole('button', { name: 'Confirm copy to account', disabled: true }));
  expect(service.transfer).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/The copied snapshot is acknowledged/)).toBeNull();
  await act(async () => finish());
  await screen.findByText(/The copied snapshot is acknowledged, synchronized, and verified/);
});

test('interrupted transfer shows actionable error and refresh exposes the same pending snapshot for retry', async () => {
  jest
    .mocked(service.transfer)
    .mockRejectedValueOnce(new Error('Network interrupted after server write'));
  mount();
  fireEvent.press(
    await screen.findByRole('button', { name: 'Add guest decks as separate copies' }),
  );
  jest.mocked(service.preview).mockResolvedValue({ ...preview, journal: 'pending' });
  fireEvent.press(screen.getByRole('button', { name: 'Confirm copy to account' }));
  await screen.findByText('Network interrupted after server write');
  expect(screen.queryByText(/The copied snapshot is acknowledged/)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Refresh preview / check connection' }));
  fireEvent.press(
    await screen.findByRole('button', { name: 'Resume the previously confirmed transfer' }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Confirm copy to account' }));
  await waitFor(() => expect(service.transfer).toHaveBeenCalledTimes(2));
  await screen.findByText(/The copied snapshot is acknowledged/);
});

test('missing backend feed does not claim that account data was loaded', async () => {
  jest.mocked(service.preview).mockResolvedValue({
    ...preview,
    scenario: 'both',
    accountVerified: false,
    account: [{ id: 'server', name: 'Missing feed deck', cards: 1 }],
    blockers: ['Backend backfill required.'],
  });
  mount();
  await screen.findByText(/Account data exists but could not be fully loaded/);
  expect(screen.queryByText(/Your account is empty/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Add guest decks as separate copies' })).toBeNull();
});
