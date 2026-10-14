import { CloudClient } from '@/core/sync/cloud-client';
import { storageScopes } from './repositories';
import { restoreLocalSession } from './sync';

jest.mock('@/core/sync/cloud-client', () => ({
  CloudClient: jest.fn(() => ({
    available: true,
    hasSession: jest.fn(),
    storedUserId: jest.fn(),
    accountProfile: jest.fn(),
    forgetLocalSession: jest.fn(),
  })),
}));
jest.mock('./repositories', () => ({
  database: null,
  storageScopes: {
    legacyAccountId: jest.fn(() => '11111111-1111-1111-1111-111111111111'),
    enterAccount: jest.fn(),
  },
}));
jest.mock('./application', () => ({ application: {} }));
const cloud = jest.mocked(CloudClient).mock.results[0]!.value as jest.Mocked<CloudClient>;
const identity = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  jest.clearAllMocks();
  cloud.hasSession.mockResolvedValue(true);
  cloud.storedUserId.mockResolvedValue(null);
  cloud.accountProfile.mockResolvedValue({
    id: identity,
    displayName: 'Current account',
    phoneNumber: null,
    email: null,
  });
  cloud.forgetLocalSession.mockResolvedValue();
});

test('legacy database ownership is not accepted as proof of the restored authenticated identity', async () => {
  await restoreLocalSession();
  expect(cloud.accountProfile).toHaveBeenCalled();
  expect(storageScopes.enterAccount).toHaveBeenCalledWith(identity);
  expect(storageScopes.legacyAccountId).not.toHaveBeenCalled();
});

test('legacy restoration without a verified identity fails closed offline rather than exposing the old owner', async () => {
  cloud.accountProfile.mockRejectedValueOnce(new Error('Offline'));
  await restoreLocalSession();
  expect(cloud.forgetLocalSession).toHaveBeenCalled();
  expect(storageScopes.enterAccount).not.toHaveBeenCalled();
});

test('cleared credentials after logout cannot restore any account while verified stored identities select their own scope', async () => {
  cloud.hasSession.mockResolvedValueOnce(false);
  await restoreLocalSession();
  expect(storageScopes.enterAccount).not.toHaveBeenCalled();
  expect(cloud.accountProfile).not.toHaveBeenCalled();
  cloud.storedUserId.mockResolvedValue(identity);
  await restoreLocalSession();
  expect(storageScopes.enterAccount).toHaveBeenCalledWith(identity);
  expect(cloud.accountProfile).not.toHaveBeenCalled();
});
