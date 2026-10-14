import * as SecureStore from 'expo-secure-store';
import { LogoutJournal, sessionReference } from './logout-journal';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));
const userId = '11111111-1111-1111-1111-111111111111';
const sessionId = '22222222-2222-2222-2222-222222222222';

test('legacy JWT session references contain only IDs and time, never usable credentials', () => {
  const jwt = `header.${btoa(JSON.stringify({ sub: userId, sid: sessionId }))}.signature`;
  const receipt = sessionReference({ accessToken: jwt });
  expect(receipt).toEqual({ userId, sessionId, requestedAtUtc: expect.any(String) });
  expect(JSON.stringify(receipt)).not.toContain(jwt);
  expect(sessionReference({ accessToken: 'corrupt', userId })).toBeNull();
});

test('concurrent revocation receipt writes are durable, deduplicated and removable without losing another account', async () => {
  let saved: string | null = null;
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async () => saved);
  jest.mocked(SecureStore.setItemAsync).mockImplementation(async (_key, value) => {
    saved = value;
  });
  const journal = new LogoutJournal();
  const receipt = { userId, sessionId, requestedAtUtc: '2026-10-14T12:00:00Z' };
  const other = { ...receipt, userId: sessionId };
  await Promise.all([journal.add(receipt), journal.add(receipt), journal.add(other)]);
  expect((await new LogoutJournal().read()).receipts).toEqual([receipt, other]);
  await journal.remove(receipt);
  expect((await journal.read()).receipts).toEqual([other]);
});
