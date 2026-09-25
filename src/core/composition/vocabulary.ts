import { config, clock } from '@/core/infrastructure/platform';
import { createDictionaryService } from '@/features/vocabulary/application/dictionary-service';
import {
  createFreeDictionaryProvider,
  dictionaryHttpClient,
} from '@/features/vocabulary/data/free-dictionary-provider';
import { createInMemoryDictionaryCache } from '@/features/vocabulary/data/in-memory-dictionary-cache';

/** Temporary cache can be swapped at this boundary without modifying forms or lookup policy. */
export const vocabularyHelper = createDictionaryService(
  createFreeDictionaryProvider(config, dictionaryHttpClient),
  createInMemoryDictionaryCache(),
  clock,
);
