import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { makeCard, makeDeck, makeSettings } from '@/../test/fixtures';
import { runMigrations } from '@/core/database/migrations';
import { installFreeTierGuards } from '@/core/database/free-tier-guards';
import { LocalStorageScopes } from '@/core/storage/local-storage-scopes';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { createApplication } from '@/core/application/create-application';
import type { Repositories } from '@/core/ports/repositories';
import { CloudClient } from './cloud-client';
import { SyncEngine } from './sync-engine';
import { SyncStore } from './sync-store';
import type { ServerChange } from './contract';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));

const credentialKey = 'lerona.cloud.credentials.v1';
const accountA = '11111111-1111-1111-1111-111111111111';
const accountB = '22222222-2222-2222-2222-222222222222';
let secure: Map<string, string>;

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  secure = new Map();
  jest
    .mocked(SecureStore.getItemAsync)
    .mockReset()
    .mockImplementation(async (key) => secure.get(key) ?? null);
  jest
    .mocked(SecureStore.setItemAsync)
    .mockReset()
    .mockImplementation(async (key, value) => {
      secure.set(key, value);
    });
  jest
    .mocked(SecureStore.deleteItemAsync)
    .mockReset()
    .mockImplementation(async (key) => {
      secure.delete(key);
    });
});
afterEach(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

async function setup(withGuest = true) {
  const files = new Map<string, RealSqliteDatabase>();
  const scopes = new LocalStorageScopes<Repositories>(async (name) => {
    const database = files.get(name) ?? (await RealSqliteDatabase.open());
    files.set(name, database);
    await runMigrations(database);
    await installFreeTierGuards(database);
    const value = createSqliteRepositories(database);
    if (!(await value.settings.get())) await value.settings.update(makeSettings());
    return { database, value };
  });
  await scopes.initialize();
  if (withGuest) await scopes.current().value.decks.create(makeDeck({ name: 'Guest only' }));
  const guest = scopes.current();
  const remote = new Map<
    string,
    { database: RealSqliteDatabase; store: SyncStore; feed: ServerChange[] }
  >();
  const sessions = new Map<string, { userId: string; sessionId: string }>();
  const revoked = new Set<string>();
  let online = true;
  let loginUser = accountA;
  let holdLogout: (() => Promise<void>) | null = null;
  let holdPush: (() => Promise<void>) | null = null;
  let corruptProgress = false;
  let backupFailure = false;
  let interruptBackup = false;
  let failBackupVerification = false;
  const backups = new Map<
    string,
    { owner: string; requestId: string; metadata: Record<string, unknown> }
  >();
  const cloud = new CloudClient(() => {
    void engine.enterGuest().catch(() => {});
  });
  const database = {
    execute: (sql: string, params?: Parameters<RealSqliteDatabase['execute']>[1]) =>
      scopes.current().database!.execute(sql, params),
    transaction: (operation: Parameters<RealSqliteDatabase['transaction']>[0]) =>
      scopes.current().database!.transaction(operation),
  };
  const store = new SyncStore(database, () => scopes.snapshot().mode === 'account');
  const engine = new SyncEngine(store, cloud, async () => online, undefined, {
    isAccount: () => scopes.snapshot().phase === 'ready' && scopes.snapshot().mode === 'account',
    enterAccount: (id) => scopes.enterAccount(id),
    enterGuest: () => scopes.enterGuest(),
    lockAccount: () => scopes.lockAccount(),
  });
  const response = (body?: unknown, status = 200) => ({
    ok: status < 400,
    status,
    json: async () => body,
  });
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!online) throw new TypeError('Offline');
    const path = String(input).replace('https://api.example.test/api/v1', '');
    if (path === '/auth/phone/login') {
      const sessionId = randomUUID();
      const accessToken = `access-${sessionId}`;
      sessions.set(accessToken, { userId: loginUser, sessionId });
      return response({
        accessToken,
        refreshToken: `refresh-${sessionId}`,
        sessionId,
        accessExpiresAtUtc: '2099-01-01T00:00:00Z',
      }) as Response;
    }
    const token =
      (init?.headers as Record<string, string>)?.Authorization?.replace('Bearer ', '') ?? '';
    const session = sessions.get(token);
    if (!session || revoked.has(session.sessionId)) return response(null, 401) as Response;
    if (path === '/me/')
      return response({ id: session.userId, displayName: 'Account' }) as Response;
    if (path === '/auth/logout') {
      if (holdLogout) await holdLogout();
      revoked.add(session.sessionId);
      return response(null, 204) as Response;
    }
    if (path.startsWith('/auth/logout/')) {
      const target = [...sessions.values()].find(
        (saved) =>
          saved.sessionId === path.slice('/auth/logout/'.length) && saved.userId === session.userId,
      );
      if (target) revoked.add(target.sessionId);
      return response(null, 204) as Response;
    }
    if (!remote.has(session.userId)) {
      const database = await RealSqliteDatabase.open();
      await runMigrations(database);
      const store = new SyncStore(database);
      await store.bind(session.userId);
      remote.set(session.userId, { database, store, feed: [] });
    }
    const server = remote.get(session.userId)!;
    if (path === '/backups/') {
      if (backupFailure) return response({ code: 'backup_storage_failed' }, 503) as Response;
      const request = JSON.parse(init!.body as string) as {
        requestId: string;
        expectedSyncVersion: number;
      };
      let stored = [...backups.values()].find(
        (saved) => saved.owner === session.userId && saved.requestId === request.requestId,
      );
      if (!stored) {
        const completedAtUtc = new Date().toISOString();
        const metadata = {
          id: randomUUID(),
          status: 'Completed',
          formatVersion: 1,
          createdAtUtc: completedAtUtc,
          completedAtUtc,
          expiresAtUtc: new Date(Date.parse(completedAtUtc) + 7 * 86_400_000).toISOString(),
          retentionDays: 7,
          syncVersion: server.feed.length,
          sizeBytes: 1000,
          failureCode: null,
          isExpired: false,
          canRestore: false,
        };
        stored = { owner: session.userId, requestId: request.requestId, metadata };
        backups.set(metadata.id, stored);
      }
      if (interruptBackup) {
        interruptBackup = false;
        throw new TypeError('Interrupted after server commit');
      }
      return response(stored.metadata, 201) as Response;
    }
    if (path === '/backups/status') {
      const owned = [...backups.values()].filter((item) => item.owner === session.userId);
      return response({ latestCompleted: owned.at(-1)?.metadata ?? null }) as Response;
    }
    if (path === '/backups/?page=1&limit=1') {
      const owned = [...backups.values()].filter((item) => item.owner === session.userId);
      return response({
        items: owned.length ? [owned.at(-1)!.metadata] : [],
        nextPage: null,
      }) as Response;
    }
    if (path.startsWith('/backups/')) {
      if (failBackupVerification) {
        failBackupVerification = false;
        return response(null, 503) as Response;
      }
      const stored = backups.get(path.slice('/backups/'.length));
      return stored?.owner === session.userId
        ? (response(stored.metadata) as Response)
        : (response(null, 404) as Response);
    }
    if (path === '/sync/push') {
      const request = JSON.parse(init!.body as string) as {
        changes: Omit<ServerChange, 'serverVersion'>[];
      };
      const incoming = request.changes[0]!;
      let change = server.feed.find(
        (saved) =>
          saved.clientChangeId === incoming.clientChangeId && saved.deviceId === incoming.deviceId,
      );
      const duplicate = !!change;
      if (!change) {
        change = { ...incoming, serverVersion: server.feed.length + 1 };
        await server.store.applyPage({
          cursor: change.serverVersion,
          latestVersion: change.serverVersion,
          hasMore: false,
          changes: [change],
        });
        server.feed.push(change);
      }
      if (holdPush) await holdPush();
      return response({
        cursor: server.feed.length,
        changes: [
          { status: duplicate ? 'duplicate' : 'applied', serverVersion: change.serverVersion },
        ],
      }) as Response;
    }
    if (path.startsWith('/sync/pull?')) {
      const cursor = Number(new URL(String(input)).searchParams.get('cursor'));
      const changes = server.feed.filter((change) => change.serverVersion > cursor).slice(0, 100);
      const next = changes.at(-1)?.serverVersion ?? cursor;
      return response({
        cursor: next,
        latestVersion: server.feed.length,
        hasMore: next < server.feed.length,
        changes,
      }) as Response;
    }
    if (path === '/me/decks') {
      return response(
        (
          await server.database.execute('SELECT id, name FROM decks WHERE archived_at IS NULL')
        ).rows.map((deck) => ({ ...deck, archivedAtUtc: null })),
      ) as Response;
    }
    const cards = /^\/me\/decks\/([^/]+)\/cards$/.exec(path);
    if (cards)
      return response(
        (
          await server.database.execute(
            'SELECT id, deck_id, front_text, meaning FROM cards WHERE deck_id = ? AND archived_at IS NULL',
            [cards[1]!],
          )
        ).rows.map((card) => ({
          id: card.id,
          deckId: card.deck_id,
          frontText: card.front_text,
          meaning: card.meaning,
          archivedAtUtc: null,
        })),
      ) as Response;
    const statePath = /^\/me\/cards\/([^/]+)\/review-state$/.exec(path);
    if (statePath) {
      const state = (
        await server.database.execute('SELECT * FROM card_review_state WHERE card_id = ?', [
          statePath[1]!,
        ])
      ).rows[0];
      if (!state) return response(null, 404) as Response;
      return response({
        cardId: statePath[1],
        box: corruptProgress ? 5 : state.box,
        dueDate: state.due_date,
        totalReviews: state.total_reviews,
        totalSuccesses: state.total_successes,
        consecutiveSuccesses: state.consecutive_successes,
        lastReviewedAtUtc: state.last_reviewed_at,
      }) as Response;
    }
    throw new Error(`Unexpected test request: ${path}`);
  });
  const login = async (userId = accountA) => {
    loginUser = userId;
    await engine.signInPhone('+989121234567', 'private password');
  };
  const createPrivate = async (name = 'Account A') => {
    const app = createApplication(
      scopes.current().value,
      { now: () => new Date('2026-10-14T12:00:00.000Z'), timeZone: () => 'UTC' },
      { create: randomUUID },
    );
    const deck = await app.createDeck(makeDeck({ name }));
    await app.createCard({ ...makeCard(), deckId: deck.id });
    return app;
  };
  return {
    scopes,
    files,
    guest,
    cloud,
    engine,
    store,
    remote,
    backups,
    revoked,
    login,
    createPrivate,
    offline: () => {
      online = false;
    },
    reconnect: () => {
      online = true;
    },
    holdLogout: (action: () => Promise<void>) => {
      holdLogout = action;
    },
    holdPush: (action: () => Promise<void>) => {
      holdPush = action;
    },
    corruptProgress: () => {
      corruptProgress = true;
    },
    failBackup: () => {
      backupFailure = true;
    },
    interruptBackup: () => {
      interruptBackup = true;
    },
    failBackupVerification: () => {
      failBackupVerification = true;
    },
  };
}

test('verified account sync completes before logout; guest data and account review history remain isolated', async () => {
  const fixture = await setup();
  await fixture.login();
  const app = await fixture.createPrivate();
  const session = await app.startStudySession({ kind: 'all-decks' });
  const item = await app.getCurrentStudyItem(session.id);
  await app.submitStudyAnswer({
    sessionId: session.id,
    cardId: item!.cardId,
    presentationId: item!.presentationId,
    result: 'success',
  });
  const account = fixture.scopes.current();
  const result = await fixture.engine.signOut(true);
  expect(result).toEqual({
    synchronized: true,
    serverRevoked: true,
    credentialsCleared: true,
    retryAvailable: true,
    backup: expect.objectContaining({
      status: 'Completed',
      retentionDays: 7,
      isExpired: false,
      canRestore: false,
    }),
  });
  expect(await fixture.scopes.current().value.decks.list()).toEqual([
    makeDeck({ name: 'Guest only' }),
  ]);
  expect(await account.value.reviews.listEvents()).toHaveLength(1);
  expect(await account.value.reviews.getState(item!.cardId)).toMatchObject({
    totalReviews: 1,
    totalSuccesses: 1,
  });
  expect(
    await fixture.remote.get(accountA)!.database.execute('SELECT * FROM review_events'),
  ).toMatchObject({ rows: [expect.anything()] });
  expect(secure.has(credentialKey)).toBe(false);
  expect(JSON.stringify([...secure.values()])).not.toMatch(/access-|refresh-/);
  expect(await fixture.cloud.hasSession()).toBe(false);
  expect(fixture.backups.size).toBe(1);
  expect((await fixture.cloud.logoutStatus())?.backup?.id).toBe(result.backup!.id);
  const uploads = jest
    .mocked(fetch)
    .mock.calls.filter(([url]) => String(url).endsWith('/sync/push'));
  expect(uploads.every(([, init]) => !String(init?.body).includes('Guest only'))).toBe(true);
});

test('server backup failure preserves the authenticated session and requires an explicit no-backup logout', async () => {
  const fixture = await setup();
  await fixture.login();
  await fixture.createPrivate();
  fixture.failBackup();
  await expect(fixture.engine.signOut(true)).rejects.toThrow('Server backup was not confirmed');
  expect(await fixture.cloud.hasSession()).toBe(true);
  expect(fixture.scopes.snapshot().mode).toBe('account');
  expect(fixture.revoked.size).toBe(0);
  expect(fixture.backups.size).toBe(0);
  await fixture.engine.signOut(false);
  expect(fixture.scopes.snapshot().mode).toBe('guest');
  expect((await fixture.scopes.current().value.decks.list())[0]!.name).toBe('Guest only');
});

test('interrupted backup retry reuses its durable ID across restart; a later explicit logout requests a new backup', async () => {
  const fixture = await setup();
  await fixture.login();
  await fixture.createPrivate();
  fixture.interruptBackup();
  await expect(fixture.engine.signOut(true)).rejects.toThrow('Server backup was not confirmed');
  expect(fixture.backups.size).toBe(1);
  expect(fixture.revoked.size).toBe(0);
  const originalId = [...fixture.backups.keys()][0];
  const restartedClient = new CloudClient();
  const receipt = await restartedClient.createBackup((await fixture.store.account()).cursor);
  expect(receipt.id).toBe(originalId);
  const result = await fixture.engine.signOut(true);
  expect(result.backup!.id).not.toBe(originalId);
  expect(fixture.backups.size).toBe(2);
  const requests = jest
    .mocked(fetch)
    .mock.calls.filter(([url]) => String(url).endsWith('/backups/'));
  const requestIds = requests.map(
    ([, init]) => (JSON.parse(init!.body as string) as { requestId: string }).requestId,
  );
  expect(requestIds[0]).toBe(requestIds[1]);
  expect(new Set(requestIds).size).toBe(2);
  expect(requests.every(([, init]) => !String(init!.body).includes('userId'))).toBe(true);
});

test('manual backup syncs and verifies account data without logout; a later manual request creates a new artifact', async () => {
  const fixture = await setup();
  await fixture.login();
  await fixture.createPrivate();
  expect(await fixture.engine.backupStatus()).toEqual({ latest: null, lastSuccessful: null });
  const first = await fixture.engine.createBackup();
  expect(first.syncVersion).toBe(fixture.remote.get(accountA)!.feed.length);
  expect(await fixture.engine.backupStatus()).toEqual({
    latest: expect.objectContaining({ id: first.id }),
    lastSuccessful: expect.objectContaining({ id: first.id }),
  });
  expect(fixture.revoked.size).toBe(0);
  expect(await fixture.cloud.hasSession()).toBe(true);
  expect(fixture.scopes.snapshot().mode).toBe('account');
  const second = await fixture.engine.createBackup();
  expect(second.id).not.toBe(first.id);
  expect(second.syncVersion).toBe(first.syncVersion);
  expect(fixture.backups.size).toBe(2);
  await fixture.engine.signOut(false);
  await fixture.login(accountB);
  expect(await fixture.engine.backupStatus()).toEqual({ latest: null, lastSuccessful: null });
});

test('offline manual backup fails before creation and does not revoke or expose account data to guests', async () => {
  const fixture = await setup();
  await fixture.login();
  await fixture.createPrivate();
  fixture.offline();
  await expect(fixture.engine.createBackup()).rejects.toThrow('connection is required');
  expect(fixture.backups.size).toBe(0);
  expect(fixture.revoked.size).toBe(0);
  expect(fixture.scopes.snapshot().mode).toBe('account');
  await fixture.engine.signOut(false);
  await expect(fixture.engine.backupStatus()).rejects.toThrow('authenticated account');
  await expect(fixture.engine.createBackup()).rejects.toThrow('authenticated account');
});

test('expired authentication during manual backup invokes the existing credential clearing and guest isolation', async () => {
  const fixture = await setup();
  await fixture.login();
  await fixture.createPrivate();
  const session = JSON.parse(secure.get(credentialKey)!) as { sessionId: string };
  fixture.revoked.add(session.sessionId);
  await expect(fixture.engine.createBackup()).rejects.toMatchObject({ status: 401 });
  expect(fixture.backups.size).toBe(0);
  expect(secure.has(credentialKey)).toBe(false);
  expect(fixture.scopes.snapshot().mode).toBe('guest');
  expect((await fixture.scopes.current().value.decks.list())[0]!.name).toBe('Guest only');
});

test('backup metadata verification failure cannot log out or create a duplicate on retry', async () => {
  const fixture = await setup();
  await fixture.login();
  await fixture.createPrivate();
  fixture.failBackupVerification();
  await expect(fixture.engine.signOut(true)).rejects.toThrow();
  expect(fixture.scopes.snapshot().mode).toBe('account');
  expect(await fixture.cloud.hasSession()).toBe(true);
  expect(fixture.revoked.size).toBe(0);
  expect(fixture.backups.size).toBe(1);
  const originalId = [...fixture.backups.keys()][0];
  expect((await fixture.engine.signOut(true)).backup!.id).toBe(originalId);
  expect(fixture.backups.size).toBe(1);
});

test('logout without sync preserves queued account writes, server data, and guest data', async () => {
  const fixture = await setup();
  await fixture.login();
  await fixture.createPrivate();
  await fixture.engine.withAccount(async (_store, _cloud, synchronize) => synchronize());
  const account = fixture.scopes.current();
  await account.value.decks.update({
    ...(await account.value.decks.list())[0]!,
    name: 'Unsynced edit',
  });
  const before = await fixture.store.pending();
  jest.mocked(fetch).mockClear();
  await expect(fixture.engine.signOut()).resolves.toMatchObject({
    synchronized: false,
    serverRevoked: true,
  });
  expect(jest.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/sync/'))).toBe(false);
  expect(await new SyncStore(account.database!).pending()).toEqual(before);
  expect(
    (await fixture.remote.get(accountA)!.database.execute('SELECT name FROM decks')).rows[0]!.name,
  ).toBe('Account A');
  expect((await fixture.scopes.current().value.decks.list())[0]!.name).toBe('Guest only');
});

test('backup failure keeps the account signed in; an explicit later no-backup choice logs out safely', async () => {
  const fixture = await setup();
  await fixture.login();
  await fixture.createPrivate();
  fixture.offline();
  await expect(fixture.engine.signOut(true)).rejects.toThrow('connection');
  expect(fixture.scopes.snapshot()).toMatchObject({ mode: 'account', phase: 'ready' });
  expect(secure.has(credentialKey)).toBe(true);
  await expect(fixture.engine.signOut()).resolves.toMatchObject({
    synchronized: false,
    serverRevoked: false,
    credentialsCleared: true,
    retryAvailable: true,
  });
  expect(fixture.scopes.snapshot().mode).toBe('guest');
});

test('remote progress mismatch blocks the backup success claim and leaves originals intact', async () => {
  const fixture = await setup();
  await fixture.login();
  await fixture.createPrivate();
  fixture.corruptProgress();
  await expect(fixture.engine.signOut(true)).rejects.toThrow('review progress');
  expect(fixture.scopes.snapshot().mode).toBe('account');
  expect(secure.has(credentialKey)).toBe(true);
  expect(fixture.revoked.size).toBe(0);
});

test('offline logout immediately locks account access and restart restores only preserved guest data', async () => {
  const fixture = await setup();
  await fixture.login();
  await fixture.createPrivate();
  const prior = fixture.scopes.current();
  fixture.offline();
  const logout = fixture.engine.signOut();
  expect(() => fixture.scopes.current()).toThrow('switching');
  expect(fixture.scopes.snapshot()).toMatchObject({ mode: 'guest', userId: null });
  await logout;
  expect(() => fixture.scopes.assertCurrent(prior)).toThrow('scope changed');
  const reopened = new LocalStorageScopes<Repositories>(async (name) => {
    const database = await RealSqliteDatabase.open(fixture.files.get(name)?.handle.export());
    await runMigrations(database);
    return { database, value: createSqliteRepositories(database) };
  });
  await reopened.initialize();
  expect(await new CloudClient().hasSession()).toBe(false);
  expect((await reopened.current().value.decks.list())[0]!.name).toBe('Guest only');
  await reopened.enterAccount(accountA);
  expect((await reopened.current().value.decks.list())[0]!.name).toBe('Account A');
});

test('different-account login never reuses private queues and revocation retries require the original account', async () => {
  const fixture = await setup();
  await fixture.login();
  await fixture.createPrivate();
  const original = JSON.parse(secure.get(credentialKey)!) as { sessionId: string };
  fixture.offline();
  await fixture.engine.signOut();
  fixture.reconnect();
  await fixture.login(accountB);
  expect(await fixture.scopes.current().value.decks.list()).toEqual([]);
  expect(await fixture.store.pending()).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ entityType: 'deck' })]),
  );
  expect(fixture.revoked.has(original.sessionId)).toBe(false);
  await fixture.engine.syncNow();
  expect(
    (await fixture.remote.get(accountB)!.database.execute('SELECT * FROM decks')).rows,
  ).toEqual([]);
  await fixture.createPrivate('Account B');
  await fixture.engine.signOut();
  await fixture.login(accountA);
  expect((await fixture.scopes.current().value.decks.list())[0]!.name).toBe('Account A');
  expect(fixture.revoked.has(original.sessionId)).toBe(true);
  expect((await fixture.guest.value.decks.list())[0]!.name).toBe('Guest only');
});

test('guest access does not wait for network revocation; repeated logout shares one request', async () => {
  const fixture = await setup();
  await fixture.login();
  await fixture.createPrivate();
  let finish!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  fixture.holdLogout(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
        entered();
      }),
  );
  const first = fixture.engine.signOut();
  expect(fixture.engine.signOut()).toBe(first);
  await started;
  expect(fixture.scopes.snapshot().mode).toBe('guest');
  expect((await fixture.scopes.current().value.decks.list())[0]!.name).toBe('Guest only');
  expect(secure.has(credentialKey)).toBe(false);
  finish();
  await first;
  expect(
    jest.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/auth/logout')),
  ).toHaveLength(1);
});

test('a late account push acknowledgement cannot mutate or upload the guest queue', async () => {
  const fixture = await setup();
  await fixture.login();
  await fixture.createPrivate();
  const guestBefore = await new SyncStore(fixture.guest.database!).pending();
  let finish!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  fixture.holdPush(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
        entered();
      }),
  );
  const syncing = fixture.engine.syncNow();
  const rejected = expect(syncing).rejects.toMatchObject({ status: 401 });
  await started;
  expect(finish).toBeDefined();
  await fixture.engine.signOut();
  finish();
  await rejected;
  await fixture.engine.syncNow();
  expect(await new SyncStore(fixture.guest.database!).pending()).toEqual(guestBefore);
  await expect(fixture.engine.retryFailed()).rejects.toThrow('sign in');
});

test('credential deletion failure keeps the persistent signed-out barrier across restart', async () => {
  const fixture = await setup();
  await fixture.login();
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
    if (key === credentialKey) throw new Error('Secure storage unavailable');
    secure.delete(key);
  });
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => {
    if (key === credentialKey) throw new Error('Secure storage unavailable');
    secure.set(key, value);
  });
  await expect(fixture.engine.signOut()).resolves.toMatchObject({ credentialsCleared: false });
  expect(fixture.scopes.snapshot().mode).toBe('guest');
  expect(await new CloudClient().hasSession()).toBe(false);
  expect(fixture.engine.logoutSnapshot()?.credentialsCleared).toBe(false);
});

test('logout into an empty guest scope never copies account data and retains guest free limits', async () => {
  const fixture = await setup(false);
  await fixture.login();
  await fixture.createPrivate();
  await fixture.engine.signOut();
  expect(await fixture.scopes.current().value.decks.list()).toEqual([]);
  expect(await fixture.scopes.current().value.reviews.listEvents()).toEqual([]);
  await fixture.scopes.current().value.decks.create(makeDeck());
  await expect(
    fixture.scopes.current().value.decks.create(makeDeck({ id: 'second' })),
  ).rejects.toMatchObject({ code: 'free-tier-limit' });
  expect(await fixture.scopes.current().value.decks.list()).toHaveLength(1);
});

test('an account without authoritative sync versions cannot claim a backup', async () => {
  const fixture = await setup();
  await fixture.login();
  await fixture.createPrivate();
  const database = fixture.scopes.current().database!;
  await database.execute("UPDATE sync_operations SET status = 'discarded'");
  await expect(fixture.engine.signOut(true)).rejects.toThrow('no verified sync version');
  expect(fixture.scopes.snapshot().mode).toBe('account');
  expect(secure.has(credentialKey)).toBe(true);
  expect(fixture.revoked.size).toBe(0);
});
