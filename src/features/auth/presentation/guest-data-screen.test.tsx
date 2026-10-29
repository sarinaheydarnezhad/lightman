import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { guestTransfer } from '@/core/composition/guest-transfer';
import { storageScopes } from '@/core/composition/repositories';
import { syncEngine } from '@/core/composition/sync';
import type { TransferPreview } from '@/core/sync/guest-transfer';
import { CloudError } from '@/core/sync/cloud-client';
import { formatNumber, translate } from '@/shared/localization/localization';
import { GuestDataScreen } from './guest-data-screen';

let mockRouteParams: { language?: string } = {};
let mockSettings = { language: 'en' };

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockRouteParams,
}));
jest.mock('@/core/composition/application', () => ({
  application: { settings: { subscribe: () => () => {}, snapshot: () => mockSettings } },
}));
jest.mock('@/core/composition/repositories', () => ({
  storageScopes: { completeAccountEntry: jest.fn() },
}));
jest.mock('@/core/composition/guest-transfer', () => ({
  guestTransfer: { preview: jest.fn(), transfer: jest.fn(), finish: jest.fn(), discard: jest.fn() },
}));
jest.mock('@/core/composition/sync', () => ({
  syncEngine: {
    signOut: jest.fn(async () => {}),
    accountProfile: jest.fn(),
    updateAccountName: jest.fn(),
    status: jest.fn(),
    resolve: jest.fn(),
  },
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
  mockRouteParams = {};
  mockSettings = { language: 'en' };
  jest.mocked(syncEngine!.accountProfile).mockReset().mockResolvedValue({
    id: 'account',
    displayName: 'Student',
    phoneNumber: null,
    email: null,
  });
  jest.mocked(syncEngine!.updateAccountName).mockReset();
  jest
    .mocked(syncEngine!.status)
    .mockReset()
    .mockResolvedValue({
      userId: 'account',
      cursor: 0,
      signedIn: true,
      sessionError: null,
      pending: 0,
      failed: 0,
      conflict: 0,
      conflicts: [],
    });
  jest.mocked(syncEngine!.resolve).mockReset().mockResolvedValue();
  jest.mocked(service.preview).mockReset().mockResolvedValue(preview);
  jest.mocked(service.transfer).mockReset().mockResolvedValue();
  jest.mocked(service.finish).mockReset().mockResolvedValue();
  jest.mocked(service.discard).mockReset().mockResolvedValue();
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

test.each([
  ['en', 'server'],
  ['fa', 'local'],
] as const)(
  '%s allows an explicit %s settings choice to recover a previously failed account connection',
  async (language, choice) => {
    mockRouteParams = { language };
    jest.mocked(service.preview).mockRejectedValueOnce(new CloudError(409));
    jest
      .mocked(syncEngine!.status)
      .mockResolvedValue({
        userId: 'account',
        cursor: 0,
        signedIn: true,
        sessionError: null,
        pending: 0,
        failed: 0,
        conflict: 1,
        conflicts: [
          {
            operationId: 'saved-edit',
            entityType: 'settings',
            entityId: '',
            serverVersion: 5,
            archived: false,
          },
        ],
      });
    mount();
    await screen.findByText(translate(language, 'migration.settingsConflict'));
    expect(syncEngine!.resolve).not.toHaveBeenCalled();
    expect(storageScopes.completeAccountEntry).not.toHaveBeenCalled();
    jest
      .mocked(service.preview)
      .mockResolvedValue({ ...preview, scenario: 'empty', guest: [], hasGuestData: false });
    fireEvent.press(
      screen.getByRole('button', {
        name: translate(language, choice === 'server' ? 'sync.keepServer' : 'sync.keepLocal'),
      }),
    );
    await waitFor(() => expect(storageScopes.completeAccountEntry).toHaveBeenCalled());
    expect(syncEngine!.resolve).toHaveBeenCalledWith('saved-edit', choice);
    expect(service.discard).not.toHaveBeenCalled();
    expect(syncEngine!.signOut).not.toHaveBeenCalled();
  },
);

test.each(['en', 'fa'] as const)(
  '%s asks unnamed users for their name before checking guest data',
  async (language) => {
    mockRouteParams = { language };
    const profile = { id: 'account', displayName: '', phoneNumber: null, email: null };
    jest.mocked(syncEngine!.accountProfile).mockResolvedValue(profile);
    jest.mocked(syncEngine!.updateAccountName).mockImplementation(async (displayName) => ({
      ...profile,
      displayName,
    }));
    mount();
    const input = await screen.findByLabelText(translate(language, 'onboarding.nameLabel'));
    expect(service.preview).not.toHaveBeenCalled();
    expect(storageScopes.completeAccountEntry).not.toHaveBeenCalled();
    fireEvent.changeText(input, 'Sara');
    fireEvent.press(
      screen.getByRole('button', { name: translate(language, 'onboarding.nameSave') }),
    );
    await screen.findByRole('button', { name: translate(language, 'migration.add') });
    expect(syncEngine!.updateAccountName).toHaveBeenCalledWith('Sara');
    expect(service.preview).toHaveBeenCalledTimes(1);
  },
);

test.each(['en', 'fa'] as const)(
  '%s requires a merge or permanent discard decision',
  async (language) => {
    mockRouteParams = { language };
    mount();
    await screen.findByRole('button', { name: translate(language, 'migration.add') });
    expect(
      screen.getByRole('button', { name: translate(language, 'migration.discard') }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: translate(language, 'migration.continue') }),
    ).toBeNull();
    expect(screen.getByText(translate(language, 'migration.addHint'))).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    expect(service.discard).not.toHaveBeenCalled();
  },
);

test.each(['en', 'fa'] as const)(
  '%s merges then clears verified guest data before opening the account',
  async (language) => {
    mockRouteParams = { language };
    const both: TransferPreview = {
      ...preview,
      scenario: 'both',
      account: [{ id: 'existing', name: 'Existing', cards: 4 }],
    };
    jest.mocked(service.preview).mockResolvedValue(both);
    let finish!: () => void;
    jest.mocked(service.finish).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    mount();
    fireEvent.press(
      await screen.findByRole('button', { name: translate(language, 'migration.add') }),
    );
    await waitFor(() => expect(service.finish).toHaveBeenCalledWith(both));
    expect(service.transfer).toHaveBeenCalledWith(both, expect.any(Function));
    expect(router.replace).not.toHaveBeenCalled();
    expect(storageScopes.completeAccountEntry).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(storageScopes.completeAccountEntry).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(service.discard).not.toHaveBeenCalled();
  },
);

test.each(['en', 'fa'] as const)(
  '%s discard requires explicit irreversible confirmation',
  async (language) => {
    mockRouteParams = { language };
    mount();
    fireEvent.press(
      await screen.findByRole('button', { name: translate(language, 'migration.discard') }),
    );
    await screen.findByText(translate(language, 'migration.discardTitle'));
    expect(service.discard).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: translate(language, 'common.cancel') }));
    expect(service.discard).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: translate(language, 'migration.discard') }));
    fireEvent.press(
      screen.getByRole('button', { name: translate(language, 'migration.discardConfirm') }),
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(service.discard).toHaveBeenCalledWith(preview);
    expect(service.transfer).not.toHaveBeenCalled();
  },
);

test('discard failure preserves the decision gate and does not open account screens', async () => {
  jest.mocked(service.discard).mockRejectedValueOnce(new Error('Disk full'));
  mount();
  fireEvent.press(
    await screen.findByRole('button', { name: translate('en', 'migration.discard') }),
  );
  fireEvent.press(
    screen.getByRole('button', { name: translate('en', 'migration.discardConfirm') }),
  );
  await screen.findByText('Disk full');
  expect(router.replace).not.toHaveBeenCalled();
  expect(storageScopes.completeAccountEntry).not.toHaveBeenCalled();
});

test.each(['account-only', 'empty', 'complete'] as const)(
  '%s automatically opens the synchronized account',
  async (scenario) => {
    const result: TransferPreview = {
      ...preview,
      scenario: scenario === 'complete' ? 'guest-only' : scenario,
      guest: scenario === 'complete' ? preview.guest : [],
      journal: scenario === 'complete' ? 'complete' : null,
    };
    jest.mocked(service.preview).mockResolvedValue(result);
    mount();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(service.transfer).not.toHaveBeenCalled();
    if (scenario === 'complete') expect(service.finish).toHaveBeenCalledWith(result);
    else expect(service.finish).not.toHaveBeenCalled();
  },
);

test('archived-only guest data still requires explicit discard instead of automatic deletion', async () => {
  jest.mocked(service.preview).mockResolvedValue({ ...preview, guest: [], hasGuestData: true });
  mount();
  await screen.findByRole('button', { name: translate('en', 'migration.discard') });
  expect(router.replace).not.toHaveBeenCalled();
  expect(service.discard).not.toHaveBeenCalled();
});

test('Persian login language and counts survive English account settings', async () => {
  mockRouteParams = { language: 'fa' };
  mount();
  await screen.findByRole('button', { name: translate('fa', 'migration.add') });
  expect(screen.getByRole('header', { name: translate('fa', 'migration.title') })).toBeTruthy();
  expect(
    screen.getByText(
      translate('fa', 'migration.deck', { name: 'Words', cards: formatNumber(2, 'fa') }),
    ),
  ).toBeTruthy();
  expect(
    screen.getByText(translate('fa', 'migration.reviews', { count: formatNumber(3, 'fa') })),
  ).toBeTruthy();
});

test.each([undefined, 'invalid'])(
  'uses account language when route language is %s',
  async (language) => {
    mockRouteParams = { language };
    mockSettings = { language: 'fa' };
    mount();
    await screen.findByRole('button', { name: translate('fa', 'migration.add') });
  },
);

test('quota blockers disable transfer and never implicitly discard guest data', async () => {
  mockRouteParams = { language: 'fa' };
  jest.mocked(service.preview).mockResolvedValue({
    ...preview,
    blockers: [
      'Adding these decks would exceed the current free limits: 1 active deck and 50 active cards. Keep the datasets separate.',
    ],
  });
  mount();
  await screen.findByText(translate('fa', 'migration.reason.limits'));
  fireEvent.press(
    screen.getByRole('button', { name: translate('fa', 'migration.add'), disabled: true }),
  );
  expect(service.transfer).not.toHaveBeenCalled();
  expect(service.discard).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

test('incomplete account sync never bypasses the gate as an empty account', async () => {
  jest.mocked(service.preview).mockResolvedValue({
    ...preview,
    guest: [],
    scenario: 'empty',
    accountVerified: false,
  });
  mount();
  await screen.findByText(translate('en', 'migration.incomplete'));
  expect(router.replace).not.toHaveBeenCalled();
});

test('Persian network failures do not leak raw English errors or bypass the gate', async () => {
  mockRouteParams = { language: 'fa' };
  jest
    .mocked(service.preview)
    .mockRejectedValue(new CloudError(0, undefined, 'Failed to fetch', 'network_error'));
  mount();
  await screen.findByText(translate('fa', 'migration.reason.network'));
  expect(screen.queryByText('Failed to fetch')).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
});

test('busy progress prevents duplicate transfers and destructive choices', async () => {
  let finish!: () => void;
  jest.mocked(service.transfer).mockImplementationOnce(async (_preview, progress) => {
    progress?.({ acknowledged: 2, total: 5 });
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  mount();
  const transfer = await screen.findByRole('button', { name: translate('en', 'migration.add') });
  fireEvent.press(transfer);
  fireEvent.press(transfer);
  await screen.findByText(translate('en', 'migration.progress', { acknowledged: '2', total: '5' }));
  fireEvent.press(
    screen.getByRole('button', { name: translate('en', 'migration.discard'), disabled: true }),
  );
  expect(service.transfer).toHaveBeenCalledTimes(1);
  expect(service.discard).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => finish());
  await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
});

test('an interrupted transfer retries the same approved snapshot and cannot be discarded as if nothing uploaded', async () => {
  jest
    .mocked(service.transfer)
    .mockRejectedValueOnce(new Error('Network interrupted after server write'));
  mount();
  fireEvent.press(await screen.findByRole('button', { name: translate('en', 'migration.add') }));
  await screen.findByText('Network interrupted after server write');
  expect(router.replace).not.toHaveBeenCalled();
  jest.mocked(service.preview).mockResolvedValue({ ...preview, journal: 'pending' });
  fireEvent.press(screen.getByRole('button', { name: translate('en', 'migration.retry') }));
  const resume = await screen.findByRole('button', { name: translate('en', 'migration.resume') });
  expect(screen.queryByRole('button', { name: translate('en', 'migration.discard') })).toBeNull();
  expect(screen.queryByRole('button', { name: translate('en', 'migration.continue') })).toBeNull();
  fireEvent.press(resume);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  expect(service.transfer).toHaveBeenCalledTimes(2);
});

test('cleanup failures after a completed transfer retry cleanup without starting another copy', async () => {
  jest.mocked(service.preview).mockResolvedValue({ ...preview, journal: 'complete' });
  jest.mocked(service.finish).mockRejectedValueOnce(new Error('Disk full'));
  mount();
  await screen.findByText('Disk full');
  expect(router.replace).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: translate('en', 'migration.retry') }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  expect(service.finish).toHaveBeenCalledTimes(2);
  expect(service.transfer).not.toHaveBeenCalled();
});

test('a transfer finishing after unmount never navigates or opens a different account', async () => {
  let finish!: () => void;
  jest.mocked(service.transfer).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = mount();
  fireEvent.press(await screen.findByRole('button', { name: translate('en', 'migration.add') }));
  view.unmount();
  await act(async () => finish());
  expect(router.replace).not.toHaveBeenCalled();
  expect(storageScopes.completeAccountEntry).not.toHaveBeenCalled();
});

test('failed initial sync still allows an explicitly confirmed logout without claiming a merge', async () => {
  jest.mocked(service.preview).mockRejectedValueOnce(new Error('Offline'));
  mount();
  await screen.findByText('Offline');
  fireEvent.press(screen.getByRole('button', { name: translate('en', 'common.close') }));
  fireEvent.press(screen.getByRole('button', { name: translate('en', 'account.logout') }));
  expect(syncEngine!.signOut).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: translate('en', 'logout.withoutBackup') }));
  await waitFor(() => expect(syncEngine!.signOut).toHaveBeenCalled());
  expect(service.transfer).not.toHaveBeenCalled();
  expect(service.discard).not.toHaveBeenCalled();
});
