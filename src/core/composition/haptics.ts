import type { HapticFeedbackService } from '@/core/ports/haptic-feedback';
import { createHapticFeedbackService } from '@/core/infrastructure/haptic-feedback';
import { performExpoHaptic } from '@/core/infrastructure/expo-haptic-feedback';
import { logger } from '@/core/infrastructure/platform';
import { application } from './application';

/** The repository owns the preference; there is no parallel UI state or storage. */
export const haptics: HapticFeedbackService = createHapticFeedbackService(
  async () => (await application.getSettings())?.hapticsEnabled ?? true,
  performExpoHaptic,
  () => logger.info('Haptic feedback unavailable.'),
);
