import { database, storageScopes } from './repositories';
import { CloudClient } from '@/core/sync/cloud-client';
import { SyncStore } from '@/core/sync/sync-store';
import { SyncEngine } from '@/core/sync/sync-engine';
import { application, refreshStudyReminder } from './application';
import { logger } from '@/core/infrastructure/platform';
import { router } from 'expo-router';
import { invalidateLearningAccess, learningAccess } from './learning-access';

const isAccount = () =>
  storageScopes.snapshot().phase === 'ready' && storageScopes.snapshot().mode === 'account';
export const cloud = new CloudClient(() => {
  void syncEngine
    ?.enterGuest()
    .catch((error: unknown) => logger.error('Unable to open guest storage', error));
}, invalidateLearningAccess);

export const syncEngine = database
  ? new SyncEngine(
      new SyncStore(database, isAccount),
      cloud,
      undefined,
      async () => {
        await application.settings.get();
        await refreshStudyReminder();
        await learningAccess().refresh();
      },
      {
        isAccount,
        enterAccount: (userId) => storageScopes.enterAccount(userId),
        enterGuest: () => storageScopes.enterGuest(),
        lockAccount: () => storageScopes.lockAccount(),
      },
      () => {
        void learningAccess()
          .refresh()
          .catch(() => {});
        router.replace('/auth/guest-data' as import('expo-router').Href);
      },
    )
  : null;

export async function restoreLocalSession(): Promise<void> {
  await syncEngine?.restoreLogoutNotice().catch(() => {});
  if (!cloud.available || !(await cloud.hasSession())) return;
  let userId = await cloud.storedUserId();
  if (!userId) {
    try {
      userId = (await cloud.accountProfile()).id;
    } catch {
      await cloud.forgetLocalSession();
      return;
    }
  }
  if (userId) await storageScopes.enterAccount(userId);
  else await cloud.forgetLocalSession();
}
