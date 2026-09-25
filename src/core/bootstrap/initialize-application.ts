import { defaultSettings } from '@/core/composition/default-settings';
import { application } from '@/core/composition/application';

let reminderSynchronized = false;

export async function initializeApplication(): Promise<void> {
  // A native schedule can outlive this in-memory repository.
  await application.settings.initialize(defaultSettings());
  // Native schedules outlive this session-only repository. Reconcile once on startup.
  if (!reminderSynchronized) {
    await application.settings.reconcileReminder();
    reminderSynchronized = true;
  }
}
