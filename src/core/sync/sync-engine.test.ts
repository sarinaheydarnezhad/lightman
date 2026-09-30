import { SyncEngine } from './sync-engine';
import { CloudError, type CloudClient } from './cloud-client';
import type { SyncStore } from './sync-store';
import type { PendingOperation, PullPage } from './contract';

jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn(), addNetworkStateListener: jest.fn() }));

const operation: PendingOperation = {
  sequence: 1, operationId: 'operation-one', entityType: 'deck', entityId: 'deck-one',
  operation: 'upsert', payload: { name: 'offline' }, expectedVersion: 0,
  createdAt: '2026-09-30T10:00:00.000Z', retryCount: 0, status: 'pending',
};

function setup(connected = true) {
  let cursor = 0;
  const store = {
    account: jest.fn(async () => ({ userId: 'user-one', deviceId: 'device-one', cursor })),
    pending: jest.fn(async () => [operation]),
    prepare: jest.fn(async (change: PendingOperation) => ({ ...change, retryCount: change.retryCount + 1 })),
    acknowledge: jest.fn(async () => {}),
    failed: jest.fn(async () => {}),
    conflict: jest.fn(async () => {}),
    applyPage: jest.fn(async (page: PullPage) => { cursor = page.cursor; }),
  };
  const cloud = {
    available: true,
    hasSession: jest.fn(async () => true),
    push: jest.fn(async () => ({ cursor: 1, changes: [{ status: 'applied', serverVersion: 1 }] })),
    pull: jest.fn(async () => ({ cursor: 1, latestVersion: 1, hasMore: false,
      changes: [{ entityType: 'deck' as const, entityId: 'deck-one', operation: 'upsert' as const,
        deviceId: 'device-one', clientChangeId: 'operation-one', clientChangedAtUtc: operation.createdAt,
        serverVersion: 1, payload: { name: 'offline' } }] })),
  };
  const engine = new SyncEngine(store as unknown as SyncStore, cloud as unknown as CloudClient,
    async () => connected);
  return { store, cloud, engine };
}

test('offline study queue never makes a network request', async () => {
  const { engine, cloud, store } = setup(false);
  await engine.syncNow();
  expect(store.pending).not.toHaveBeenCalled();
  expect(cloud.push).not.toHaveBeenCalled();
});

test('a successful push acknowledges the original operation and pulls from the current cursor', async () => {
  const { engine, cloud, store } = setup();
  await engine.syncNow();
  expect(cloud.push).toHaveBeenCalledWith({ ...operation, retryCount: 1 }, 'device-one', 'user-one');
  expect(store.acknowledge).toHaveBeenCalledWith({ ...operation, retryCount: 1 }, 1);
  expect(cloud.pull).toHaveBeenCalledWith(0);
  expect(store.applyPage).toHaveBeenCalledTimes(1);
});

test('duplicate acknowledgements still clear the pending operation', async () => {
  const { engine, cloud, store } = setup();
  cloud.push.mockResolvedValueOnce({ cursor: 1, changes: [{ status: 'duplicate', serverVersion: 1 }] });
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
  } finally { jest.clearAllTimers(); jest.useRealTimers(); }
});

test('conflicting deck edits stay visible, while pull still applies independent history', async () => {
  const { engine, cloud, store } = setup();
  const conflict = { entityType: 'deck' as const, entityId: 'deck-one', expectedVersion: 0,
    actualVersion: 2, serverValue: { name: 'server' }, clientValue: { name: 'offline' } };
  cloud.push.mockRejectedValueOnce(new CloudError(409, conflict));
  await engine.syncNow();
  expect(store.conflict).toHaveBeenCalledWith({ ...operation, retryCount: 1 }, conflict);
  expect(store.acknowledge).not.toHaveBeenCalled();
  expect(cloud.pull).toHaveBeenCalledWith(0);
});
