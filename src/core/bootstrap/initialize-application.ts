import { defaultSettings } from '@/core/composition/default-settings';
import { application } from '@/core/composition/application';
import { database, initializeRepositories } from '@/core/composition/repositories';
import { logger } from '@/core/infrastructure/platform';

let initialization: Promise<void> | null = null;

export function initializeApplication(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      await initializeRepositories();
      if (database) {
        const { restoreLocalSession, syncEngine } = await import('@/core/composition/sync');
        await restoreLocalSession();
        syncEngine?.start();
      }
      void Promise.resolve()
        .then(() => application.settings.initialize(defaultSettings()))
        .then(() => application.settings.reconcileReminder())
        .catch((error: unknown) => {
          logger.error('Unable to initialize application services', error);
        });
    })().catch((error: unknown) => {
      initialization = null;
      throw error;
    });
  }
  return initialization;
}
