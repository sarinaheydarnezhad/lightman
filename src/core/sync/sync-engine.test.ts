import { SyncEngine } from './sync-engine';
import { CloudError, type CloudClient } from './cloud-client';
import type { SyncStore } from './sync-store';
import type { PendingOperation, PullPage } from './contract';

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));

test.each([false, true])('account profile reads require account scope (%s)', async (signedIn) => {
  const profile = { id: 'user-one', displayName: 'Student', phoneNumber: null, email: null };
  const cloud = { accountProfile: jest.fn(async () => profile) };
  const engine = new SyncEngine(
    {} as SyncStore,
    cloud as unknown as CloudClient,
    undefined,
    undefined,
    {
      isAccount: () => signedIn,
      enterAccount: jest.fn(async () => {}),
      enterGuest: jest.fn(async () => {}),
    },
  );
  if (signedIn) {
    await expect(engine.accountProfile()).resolves.toEqual(profile);
    expect(cloud.accountProfile).toHaveBeenCalledTimes(1);
  } else {
    await expect(engine.accountProfile()).rejects.toThrow('Please sign in first.');
    expect(cloud.accountProfile).not.toHaveBeenCalled();
  }
});

const operation: PendingOperation = {
  sequence: 1,
  operationId: 'operation-one',
  entityType: 'deck',
  entityId: 'deck-one',
  operation: 'upsert',
  payload: { name: 'offline' },
  expectedVersion: 0,
  createdAt: '2026-09-30T10:00:00.000Z',
  retryCount: 0,
  status: 'pending',
};

function setup(connected = true) {
  let cursor = 0;
  const store = {
    account: jest.fn(async () => ({ userId: 'user-one', deviceId: 'device-one', cursor })),
    pending: jest.fn(async () => [operation]),
    prepare: jest.fn(async (change: PendingOperation) => ({
      ...change,
      retryCount: change.retryCount + 1,
    })),
    acknowledge: jest.fn(async () => {}),
    failed: jest.fn(async () => {}),
    conflict: jest.fn(async () => {}),
    applyPage: jest.fn(async (page: PullPage) => {
      cursor = page.cursor;
    }),
  };
  const cloud = {
    available: true,
    accountProfile: jest.fn(async () => ({
      id: 'user-one',
      displayName: 'Student',
      phoneNumber: null,
      email: null,
    })),
    hasSession: jest.fn(async () => true),
    push: jest.fn(async () => ({ cursor: 1, changes: [{ status: 'applied', serverVersion: 1 }] })),
    pull: jest.fn(async () => ({
      cursor: 1,
      latestVersion: 1,
      hasMore: false,
      changes: [
        {
          entityType: 'deck' as const,
          entityId: 'deck-one',
          operation: 'upsert' as const,
          deviceId: 'device-one',
          clientChangeId: 'operation-one',
          clientChangedAtUtc: operation.createdAt,
          serverVersion: 1,
          payload: { name: 'offline' },
        },
      ],
    })),
  };
  const engine = new SyncEngine(
    store as unknown as SyncStore,
    cloud as unknown as CloudClient,
    async () => connected,
  );
  return { store, cloud, engine };
}

test('offline study queue never makes a network request', async () => {
  const { engine, cloud, store } = setup(false);
  await engine.syncNow();
  expect(store.pending).not.toHaveBeenCalled();
  expect(cloud.push).not.toHaveBeenCalled();
});

test('guest mode never reads credentials, uploads the guest outbox or pulls account data', async () => {
  const { cloud, store } = setup();
  const lifecycle = { isAccount: () => false, enterAccount: jest.fn(), enterGuest: jest.fn() };
  const engine = new SyncEngine(
    store as unknown as SyncStore,
    cloud as unknown as CloudClient,
    async () => true,
    undefined,
    lifecycle,
  );
  await engine.syncNow();
  expect(cloud.hasSession).not.toHaveBeenCalled();
  expect(cloud.push).not.toHaveBeenCalled();
  expect(cloud.pull).not.toHaveBeenCalled();
  expect(store.pending).not.toHaveBeenCalled();
});

test('authentication activates isolated account storage before binding; logout always reopens guest even offline', async () => {
  const { cloud, store } = setup();
  const events: string[] = [];
  const lifecycle = {
    isAccount: () => false,
    enterAccount: jest.fn(async () => {
      events.push('account');
    }),
    enterGuest: jest.fn(async () => {
      events.push('guest');
    }),
  };
  const bind = jest.fn(async () => {
    events.push('bind');
  });
  const credentials = {
    ...cloud,
    signInPhone: jest.fn(
      async (_phone: string, _password: string, bindUser: (id: string) => Promise<void>) => {
        await bindUser('11111111-1111-1111-1111-111111111111');
        events.push('save');
        return '11111111-1111-1111-1111-111111111111';
      },
    ),
    signOut: jest.fn(async () => {
      throw new CloudError(0, undefined, 'Revocation unconfirmed');
    }),
  };
  const engine = new SyncEngine(
    { ...store, bind } as unknown as SyncStore,
    credentials as unknown as CloudClient,
    async () => false,
    undefined,
    lifecycle,
  );
  await engine.signInPhone('+989121234567', 'Password');
  expect(events).toEqual(['account', 'bind', 'save']);
  await expect(engine.signOut()).rejects.toThrow('Revocation unconfirmed');
  expect(lifecycle.enterGuest).toHaveBeenCalledTimes(1);
});

test('a successful push acknowledges the original operation and pulls from the current cursor', async () => {
  const { engine, cloud, store } = setup();
  await engine.syncNow();
  expect(cloud.push).toHaveBeenCalledWith(
    { ...operation, retryCount: 1 },
    'device-one',
    'user-one',
  );
  expect(store.acknowledge).toHaveBeenCalledWith({ ...operation, retryCount: 1 }, 1);
  expect(cloud.pull).toHaveBeenCalledWith(0);
  expect(store.applyPage).toHaveBeenCalledTimes(1);
});

test('verified authentication requests the guest preview only after isolated account binding and credential storage', async () => {
  const events: string[] = [];
  const engine = new SyncEngine(
    {
      bind: async () => {
        events.push('bind');
      },
    } as unknown as SyncStore,
    {
      signInPhone: async (
        _phone: string,
        _password: string,
        bind: (id: string) => Promise<void>,
      ) => {
        await bind('owner');
        events.push('credentials');
        return 'owner';
      },
    } as unknown as CloudClient,
    undefined,
    undefined,
    {
      isAccount: () => true,
      enterAccount: async () => {
        events.push('account');
      },
      enterGuest: async () => {},
    },
    () => {
      events.push('preview');
    },
  );
  await engine.signInPhone('+989121234567', 'password');
  expect(events).toEqual(['account', 'bind', 'credentials', 'preview']);
});

test('duplicate acknowledgements still clear the pending operation', async () => {
  const { engine, cloud, store } = setup();
  cloud.push.mockResolvedValueOnce({
    cursor: 1,
    changes: [{ status: 'duplicate', serverVersion: 1 }],
  });
  await engine.syncNow();
  expect(store.acknowledge).toHaveBeenCalledTimes(1);
});

test('transient push failure keeps the queue for bounded backoff', async () => {
  jest.useFakeTimers();
  try {
    const { engine, cloud, store } = setup();
    cloud.push.mockRejectedValueOnce(new Error('offline'));
    await engine.syncNow();
    expect(store.failed).toHaveBeenCalledWith({ ...operation, retryCount: 1 }, true);
    expect(store.applyPage).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);
  } finally {
    jest.clearAllTimers();
    jest.useRealTimers();
  }
});

test('conflicting deck edits stay visible, while pull still applies independent history', async () => {
  const { engine, cloud, store } = setup();
  const conflict = {
    entityType: 'deck' as const,
    entityId: 'deck-one',
    expectedVersion: 0,
    actualVersion: 2,
    serverValue: { name: 'server' },
    clientValue: { name: 'offline' },
  };
  cloud.push.mockRejectedValueOnce(new CloudError(409, conflict));
  await engine.syncNow();
  expect(store.conflict).toHaveBeenCalledWith({ ...operation, retryCount: 1 }, conflict);
  expect(store.acknowledge).not.toHaveBeenCalled();
  expect(cloud.pull).toHaveBeenCalledWith(0);
});
