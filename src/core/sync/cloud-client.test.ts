import * as SecureStore from 'expo-secure-store';
import { CloudClient } from './cloud-client';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}));

const credential = { accessToken: 'old-access', refreshToken: 'old-refresh',
  accessExpiresAtUtc: '2026-01-01T00:00:00.000Z' };
const rotated = { accessToken: 'new-access', refreshToken: 'new-refresh',
  accessExpiresAtUtc: '2099-01-01T00:00:00.000Z' };

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  jest.mocked(SecureStore.getItemAsync).mockReset().mockResolvedValue(JSON.stringify(credential));
  jest.mocked(SecureStore.setItemAsync).mockReset().mockResolvedValue();
  jest.mocked(SecureStore.deleteItemAsync).mockReset().mockResolvedValue();
});

afterEach(() => { delete process.env.EXPO_PUBLIC_API_URL; });

test('access expiry refreshes securely before an authenticated pull', async () => {
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => rotated })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ cursor: 0, latestVersion: 0, hasMore: false, changes: [] }) });
  await new CloudClient().pull(0);
  expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example.test/api/v1/sync/pull?cursor=0&limit=100',
    expect.objectContaining({ headers: { Authorization: 'Bearer new-access' } }));
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.any(String), JSON.stringify(rotated));
});

test('registration never persists tokens before confirming the local account binding', async () => {
  globalThis.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => rotated })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'other-user' }) });
  await expect(new CloudClient().signIn('student@example.com', 'password', async () => {
    throw new Error('Another user owns the offline database.');
  }, 'Student')).rejects.toThrow('Another user');
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

test('logout revokes the session and removes secure credentials', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(JSON.stringify(rotated));
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 204 });
  await new CloudClient().signOut();
  expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example.test/api/v1/auth/logout',
    expect.objectContaining({ headers: { Authorization: 'Bearer new-access' } }));
  expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
});
