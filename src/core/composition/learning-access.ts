import * as Network from 'expo-network';
import {
  LearningAccessController,
  localLearningUsage,
  type EntitlementCache,
} from '@/core/access/learning-access';
import { readEntitlementCache, writeEntitlementCache } from '@/core/database/entitlement-cache';
import { storageScopes } from './repositories';
import { cloud } from './sync';
import { AppError } from '@/core/errors/app-error';

let current: { scope: object; revision: number; controller: LearningAccessController } | null =
  null;

export function learningAccess(): LearningAccessController {
  const state = storageScopes.snapshot();
  const scope = storageScopes.current();
  if (current?.scope === scope && current.revision === state.revision) return current.controller;
  const userId = state.mode === 'account' ? state.userId : null;
  const assertCurrent = () => storageScopes.assertCurrent(scope, state.revision);
  const controller = new LearningAccessController({
    userId,
    usage: localLearningUsage(scope.value),
    assertCurrent,
    online: async () => {
      const network = await Network.getNetworkStateAsync();
      return network.isConnected !== false && network.isInternetReachable !== false;
    },
    fetch: async (operation) => {
      if ((await cloud.storedUserId())?.toLowerCase() !== userId)
        throw new AppError(
          'unavailable',
          'Account credentials are changing. Wait for sign-in to finish.',
        );
      const entitlements = await (operation === 'study'
        ? cloud.authorizeStudy()
        : cloud.entitlements());
      assertCurrent();
      if ((await cloud.storedUserId())?.toLowerCase() !== userId)
        throw new AppError('unavailable', 'Account credentials changed. Refresh access online.');
      return entitlements;
    },
    readCache: async () => {
      if (!userId || !scope.database) return null;
      return readEntitlementCache(scope.database, userId);
    },
    writeCache: async (cache: EntitlementCache | null) => {
      assertCurrent();
      if (!userId || !scope.database) return;
      return writeEntitlementCache(scope.database, userId, cache);
    },
  });
  current = { scope, revision: state.revision, controller };
  return controller;
}

export async function invalidateLearningAccess(message: string): Promise<void> {
  if (storageScopes.snapshot().phase === 'ready' && storageScopes.snapshot().mode === 'account')
    await learningAccess().invalidate(message);
}
