import { createApplication } from '@/core/application/create-application';
import { clock, idGenerator } from '@/core/infrastructure/platform';
import { repositories } from './repositories';
import { expoNotificationService } from '@/core/infrastructure/expo-notification-service';

/** Only this composition layer knows the concrete platform services. */
export const application = createApplication(
  repositories,
  clock,
  idGenerator,
  expoNotificationService,
);
