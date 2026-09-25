import type { SpeechService } from '@/core/ports/speech';
import { expoSpeechAdapter } from '@/core/infrastructure/expo-speech-adapter';
import { createSpeechService } from '@/core/infrastructure/speech-service';
import { logger } from '@/core/infrastructure/platform';

/** Device speech is optional and initialized only when pronunciation is requested. */
export const speech: SpeechService = createSpeechService(expoSpeechAdapter, () =>
  logger.info('Pronunciation unavailable.'),
);
