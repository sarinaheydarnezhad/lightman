import { defaultSettings } from '@/core/composition/default-settings';
import { application } from '@/core/composition/application';
import { logger } from '@/core/infrastructure/platform';

let initializationStarted = false;

export async function initializeApplication(): Promise<void> {
  if (initializationStarted) return;
  initializationStarted = true;
  // Settings and notification reconciliation are optional startup work. Run them after the
  // bootstrap gate opens so browsing and study are not blocked by native notification APIs.
  void Promise.resolve()
    .then(() => application.settings.initialize(defaultSettings()))
    .then(() => application.settings.reconcileReminder())
    .catch((error: unknown) => {
      logger.error('Unable to initialize application services', error);
    });
}
