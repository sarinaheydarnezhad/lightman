import { database } from './repositories';
import { CloudClient } from '@/core/sync/cloud-client';
import { SyncStore } from '@/core/sync/sync-store';
import { SyncEngine } from '@/core/sync/sync-engine';
import { application } from './application';

export const syncEngine = database ? new SyncEngine(new SyncStore(database), new CloudClient(),
  undefined, async () => { await application.settings.get(); }) : null;
