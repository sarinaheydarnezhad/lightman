// Run through Flashcards.Tests.MobileCloudFlowTests with LERONA_FRONTEND_DIR set.
// Only native adapters are replaced; all API responses and encrypted snapshots come from .NET over HTTP.
import * as http from 'node:http';
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { RealSqliteDatabase } from './real-sqlite';
import { makeCard, makeDeck } from './fixtures';
import { runMigrations } from '@/core/database/migrations';
import { installFreeTierGuards } from '@/core/database/free-tier-guards';
import { defaultSettings } from '@/core/composition/default-settings';
import { initializeSettingsDefaults } from '@/features/settings/data/sqlite-settings-repository';
import { LocalStorageScopes } from '@/core/storage/local-storage-scopes';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { createApplication } from '@/core/application/create-application';
import type { Repositories } from '@/core/ports/repositories';
import { CloudClient } from '@/core/sync/cloud-client';
import { SyncEngine } from '@/core/sync/sync-engine';
import { SyncStore } from '@/core/sync/sync-store';
import { GuestTransfer } from '@/core/sync/guest-transfer';

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
jest.setTimeout(40_000);

const endpoint = process.env.LERONA_FLOW_API_URL!;
const password = 'A long synthetic cloud test password 2026!';
const databases: RealSqliteDatabase[] = [];
const requests: { path: string; method: string; status: number }[] = [];
let secure = new Map<string, string>();

async function actualHttp(path: string, init: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      new URL(path, endpoint),
      { method: init.method ?? 'GET', headers: init.headers as http.OutgoingHttpHeaders },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          const status = response.statusCode!;
          requests.push({ path, method: init.method ?? 'GET', status });
          resolve({
            ok: status >= 200 && status < 300,
            status,
            headers: { get: (name: string) => response.headers[name.toLowerCase()] ?? null },
            json: async () => JSON.parse(body),
            text: async () => body,
          } as Response);
        });
      },
    );
    request.on('error', reject);
    if (init.body) request.write(String(init.body));
    request.end();
  });
}

beforeAll(() => {
  if (!endpoint?.startsWith('http://localhost:') && !endpoint?.startsWith('http://127.0.0.1:'))
    throw new Error(
      'An isolated localhost .NET test host is required. Never point this suite at production.',
    );
  process.env.EXPO_PUBLIC_API_URL = 'https://cloud-flow.invalid';
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => secure.get(key) ?? null);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => {
    secure.set(key, value);
  });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => {
    secure.delete(key);
  });
  globalThis.fetch = ((url, init) =>
    actualHttp(new URL(String(url)).pathname + new URL(String(url)).search, init)) as typeof fetch;
});
afterAll(() => {
  console.info(
    'HTTP failures (including expected injected failures):',
    requests.filter((request) => request.status >= 400),
  );
  databases.forEach((database) => database.handle.close());
  delete process.env.EXPO_PUBLIC_API_URL;
});

async function installation(phoneNumber: string, register = false, legacyDefaults = false) {
  secure = new Map(); // Simulates clearing all application data, including credentials.
  const scopes = new LocalStorageScopes<Repositories>(async () => {
    const database = await RealSqliteDatabase.open();
    databases.push(database);
    await runMigrations(database);
    await installFreeTierGuards(database);
    const value = createSqliteRepositories(database);
    if (legacyDefaults) await value.settings.update(defaultSettings());
    else await initializeSettingsDefaults(database, defaultSettings());
    await value.settings.get();
    return { database, value };
  });
  await scopes.initialize();
  const cloud = new CloudClient();
  const store = new SyncStore({
    execute: (sql, params) => scopes.current().database!.execute(sql, params),
    transaction: (action) => scopes.current().database!.transaction(action),
  });
  const engine = new SyncEngine(store, cloud, async () => true, undefined, {
    isAccount: () => scopes.snapshot().phase === 'ready' && scopes.snapshot().mode === 'account',
    enterAccount: (id) => scopes.enterAccount(id),
    enterGuest: () => scopes.enterGuest(),
    enterEmptyGuest: () => scopes.enterEmptyGuest(),
    lockAccount: () => scopes.lockAccount(),
  });
  if (register) {
    await engine.registerPhoneWithPassword({ phoneNumber, password, confirmPassword: password });
    await engine.updateAccountName('Synthetic cloud test');
  } else await engine.signInPhone(phoneNumber, password);
  const transfer = new GuestTransfer(engine, async () => ({
    guest: (await scopes.guestScope()).database!,
    account: scopes.current().database!,
    assertCurrent: () => {},
  }));
  if (legacyDefaults) {
    await expect(transfer.preview()).rejects.toMatchObject({
      status: 409,
      conflict: { entityType: 'settings' },
    });
    const conflict = (await store.conflicts())[0]!;
    // Simulate the explicit "keep server" choice exposed on the connection screen.
    await engine.resolve(conflict.operationId, 'server');
  }
  const preview = await transfer.preview();
  expect(preview.accountVerified).toBe(true);
  scopes.completeAccountEntry();
  const app = createApplication(
    scopes.current().value,
    { now: () => new Date('2026-10-27T10:00:00.000Z'), timeZone: () => 'UTC' },
    { create: randomUUID },
  );
  return { scopes, cloud, engine, store, app, preview };
}

async function addLearning(fixture: Awaited<ReturnType<typeof installation>>) {
  const deck = await fixture.app.createDeck(makeDeck({ name: 'Persisted vocabulary' }));
  const card = await fixture.app.createCard({ ...makeCard(), deckId: deck.id });
  const session = await fixture.app.startStudySession({ kind: 'all-decks' });
  const item = await fixture.app.getCurrentStudyItem(session.id);
  await fixture.app.submitStudyAnswer({
    sessionId: session.id,
    cardId: item!.cardId,
    presentationId: item!.presentationId,
    result: 'success',
  });
  await fixture.scopes.current().value.settings.update({ ...defaultSettings(), theme: 'dark' });
  return { deck, card };
}

async function download(cloud: CloudClient, id: string) {
  // Use the public client transport and saved bearer, without introducing any test data endpoint.
  const tokens = JSON.parse(secure.get('lerona.cloud.credentials.v1')!) as { accessToken: string };
  const response = await actualHttp(`/api/v1/backups/${id}/download`, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  expect(response.status).toBe(200);
  expect(await cloud.hasSession()).toBe(true);
  return response.json();
}

test('Backup Now persists local changes; a backend 503 preserves the last successful timestamp and can be retried', async () => {
  const fixture = await installation('+989120000001', true);
  const { deck, card } = await addLearning(fixture);
  const first = await fixture.engine.createBackup();
  expect(first.status).toBe('Completed');
  expect((await fixture.cloud.backupStatus()).lastSuccessful!.completedAtUtc).toBe(
    first.completedAtUtc,
  );
  await fixture.scopes
    .current()
    .value.settings.update({ ...defaultSettings(), theme: 'dark', hapticsEnabled: false });
  expect((await fixture.store.pending())[0]!.payload).toMatchObject({
    theme: 'dark',
    hapticsEnabled: false,
  });
  await actualHttp('/__test/backup-failure?enabled=true', { method: 'POST' });
  await expect(fixture.engine.createBackup()).rejects.toMatchObject({
    status: 503,
    code: 'backup_storage_failed',
  });
  expect((await fixture.scopes.current().value.settings.get())!.theme).toBe('dark');
  expect((await fixture.cloud.backupStatus()).lastSuccessful!.completedAtUtc).toBe(
    first.completedAtUtc,
  );
  expect(fixture.scopes.snapshot().mode).toBe('account');
  expect(await fixture.cloud.hasSession()).toBe(true);
  expect(await fixture.scopes.current().value.cards.getById(card.id)).not.toBeNull();
  await actualHttp('/__test/backup-failure?enabled=false', { method: 'POST' });
  const retry = await fixture.engine.createBackup();
  expect(retry.id).not.toBe(first.id);
  const saved = await download(fixture.cloud, retry.id);
  expect(saved.decks).toEqual([expect.objectContaining({ id: deck.id, name: deck.name })]);
  expect(saved.cards).toEqual([
    expect.objectContaining({ id: card.id, frontText: card.frontText }),
  ]);
  expect(saved.settings[0]).toMatchObject({ theme: 'dark', hapticsEnabled: false });
  expect(saved.reviewEvents).toHaveLength(1);
  expect(saved.reviewStates[0].totalReviews).toBe(1);
  // Reproduce the original cleared-data failure against the same real account and API.
  const recovered = await installation('+989120000001', false, true);
  expect(await recovered.scopes.current().value.settings.get()).toMatchObject({
    theme: 'dark',
    hapticsEnabled: false,
  });
  const before = requests.length;
  const fresh = await installation('+989120000001');
  expect(await fresh.scopes.current().value.cards.getById(card.id)).toMatchObject({
    frontText: card.frontText,
  });
  expect(await fresh.scopes.current().value.settings.get()).toMatchObject({
    theme: 'dark',
    hapticsEnabled: false,
  });
  expect((await fresh.scopes.current().value.reviews.getState(card.id))!.totalReviews).toBe(1);
  expect((await fresh.store.account()).cursor).toBeGreaterThan(0);
  expect(requests.slice(before).filter((r) => r.path === '/api/v1/sync/push')).toHaveLength(0);
  expect(await fresh.cloud.ownedDecks()).toEqual([expect.objectContaining({ id: deck.id })]);
});

test('Back Up and Log Out keeps local data and credentials on backend 503, then logs out only after verified persistence', async () => {
  const fixture = await installation('+989120000002', true);
  const { card } = await addLearning(fixture);
  const account = fixture.scopes.current();
  await actualHttp('/__test/backup-failure?enabled=true', { method: 'POST' });
  await expect(fixture.engine.signOut(true)).rejects.toMatchObject({
    status: 503,
    code: 'backup_storage_failed',
  });
  expect(fixture.scopes.snapshot().mode).toBe('account');
  expect(await fixture.cloud.hasSession()).toBe(true);
  expect(await account.value.cards.getById(card.id)).not.toBeNull();
  const before = requests.length;
  await actualHttp('/__test/backup-failure?enabled=false', { method: 'POST' });
  const result = await fixture.engine.signOut(true);
  expect(result).toMatchObject({
    synchronized: true,
    serverRevoked: true,
    credentialsCleared: true,
  });
  expect(fixture.scopes.snapshot().mode).toBe('guest');
  expect(await account.value.cards.getById(card.id)).not.toBeNull();
  const flow = requests.slice(before);
  expect(flow.findIndex((r) => r.path === '/api/v1/auth/logout')).toBeGreaterThan(
    flow.findIndex((r) => r.path === `/api/v1/backups/${result.backup!.id}` && r.status === 200),
  );
  const fresh = await installation('+989120000002');
  const saved = await download(fresh.cloud, result.backup!.id);
  expect(saved.cards[0].id).toBe(card.id);
  expect(await fresh.scopes.current().value.cards.getById(card.id)).not.toBeNull();
});

test('an account with no cloud data initializes and can back up without inventing settings edits or deleting anything', async () => {
  const fixture = await installation('+989120000003', true);
  expect(fixture.preview.scenario).toBe('empty');
  expect((await fixture.store.account()).cursor).toBe(0);
  expect(await fixture.store.pending()).toHaveLength(0);
  const receipt = await fixture.engine.createBackup();
  const saved = await download(fixture.cloud, receipt.id);
  expect(saved.decks).toEqual([]);
  expect(saved.cards).toEqual([]);
  expect(saved.settings).toEqual([]);
  expect((await fixture.scopes.current().value.settings.get())!.theme).toBe('light');
});
