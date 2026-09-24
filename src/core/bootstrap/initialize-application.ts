import { config } from '@/core/infrastructure/platform';
import { repositories } from '@/core/composition/repositories';
import { seedDevelopmentData } from '@/core/composition/development-seed';
import { defaultSettings } from '@/core/composition/default-settings';

export async function initializeApplication(): Promise<void> {
  if (config.environment === 'development') await seedDevelopmentData(repositories);
  if (!(await repositories.settings.get())) await repositories.settings.update(defaultSettings());
}
