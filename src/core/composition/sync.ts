import { database, storageScopes } from './repositories';
import { CloudClient } from '@/core/sync/cloud-client';
import { SyncStore } from '@/core/sync/sync-store';
import { SyncEngine } from '@/core/sync/sync-engine';
import { PostCommitDatabase } from '@/core/database/post-commit-database';
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
      {
        capture: () => {
          const scope = storageScopes.current();
          const revision = storageScopes.snapshot().revision;
          return {
            store: new SyncStore(scope.database!, isAccount),
            assertCurrent: () => storageScopes.assertCurrent(scope, revision),
          };
        },
        subscribeChanges: (listener) => {
          let unsubscribe = () => {};
          const connect = () => {
            unsubscribe();
            const db =
              storageScopes.snapshot().phase === 'ready' ? storageScopes.current().database : null;
            unsubscribe = db instanceof PostCommitDatabase ? db.subscribe(listener) : () => {};
          };
          const stop = storageScopes.subscribe(connect);
          connect();
          return () => {
            stop();
            unsubscribe();
          };
        },
        subscribeOwner: (listener) => {
          let previous = storageScopes.snapshot();
          return storageScopes.subscribe(() => {
            const next = storageScopes.snapshot();
            if (
              next.revision !== previous.revision ||
              next.phase !== previous.phase ||
              next.userId !== previous.userId ||
              next.mode !== previous.mode
            ) {
              previous = next;
              listener();
            }
          });
        },
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
