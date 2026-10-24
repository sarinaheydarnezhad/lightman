import { database, storageScopes } from './repositories';
import { CloudClient } from '@/core/sync/cloud-client';
import { SyncStore } from '@/core/sync/sync-store';
import { SyncEngine } from '@/core/sync/sync-engine';
import { application, refreshStudyReminder } from './application';
import { logger } from '@/core/infrastructure/platform';
import { invalidateLearningAccess, learningAccess } from './learning-access';
import { createPostAuthenticationNavigation } from './post-authentication-navigation';

const authenticationNavigation = createPostAuthenticationNavigation(
  () => application.settings.snapshot()?.language,
  (userId) => storageScopes.enterAccount(userId),
  (route) => storageScopes.prepareAccountEntry(route.params.language),
);

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
        await learningAccess().refreshIfStale();
      },
      {
        isAccount,
        enterAccount: authenticationNavigation.enterAccount,
        enterGuest: () => storageScopes.enterGuest(),
        enterEmptyGuest: () => storageScopes.enterEmptyGuest(),
        lockAccount: () => storageScopes.lockAccount(),
      },
      () => {
        void learningAccess()
          .refresh()
          .catch(() => {});
        authenticationNavigation.afterAuthentication();
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
  if (userId) {
    await storageScopes.enterAccount(userId);
    const guest = await storageScopes.guestScope();
    const content = await guest.database!.execute('SELECT id FROM decks LIMIT 1');
    if (content.rows.length) storageScopes.prepareAccountEntry();
    else storageScopes.completeAccountEntry();
  } else await cloud.forgetLocalSession();
}
