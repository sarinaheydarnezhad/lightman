import { GuestTransfer } from '@/core/sync/guest-transfer';
import { storageScopes } from './repositories';
import { syncEngine } from './sync';

export const guestTransfer = syncEngine
  ? new GuestTransfer(syncEngine, async () => {
      const state = storageScopes.snapshot();
      const account = storageScopes.current();
      if (state.mode !== 'account' || !state.userId || !account.database)
        throw new Error('Sign in before transferring guest data.');
      const guest = await storageScopes.guestScope();
      return {
        guest: guest.database!,
        account: account.database,
        assertCurrent: () => storageScopes.assertCurrent(account),
      };
    })
  : null;
