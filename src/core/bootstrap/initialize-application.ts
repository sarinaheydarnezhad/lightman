import { config } from '@/core/infrastructure/platform';
import { repositories } from '@/core/composition/repositories';
import { seedDevelopmentData } from '@/core/composition/development-seed';
import { defaultSettings } from '@/core/composition/default-settings';
import { application } from '@/core/composition/application';

let reminderSynchronized = false;

export async function initializeApplication(): Promise<void> {
  // A native schedule can outlive this in-memory repository. Recover it before dev seeding.
  await application.settings.initialize(defaultSettings());
  if (config.environment === 'development') await seedDevelopmentData(repositories);
  // Native schedules outlive this session-only repository. Reconcile once on startup.
  if (!reminderSynchronized) {
    await application.settings.reconcileReminder();
    reminderSynchronized = true;
  }
}
