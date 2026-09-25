import type { AppClock } from '@/core/ports/platform';
import type { DictionaryCache } from '../domain/dictionary-cache';
import type { DictionaryLookupResult } from '../domain/dictionary';
import { DictionaryProviderError, type DictionaryProvider } from '../domain/dictionary-provider';

const FOUND_TTL_MS = 60 * 60 * 1000;
const NOT_FOUND_TTL_MS = 5 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 2_000;

export interface DictionaryService {
  supports(language: string): boolean;
  lookup(word: string, language: string, retry?: boolean): Promise<DictionaryLookupResult>;
}

export function normalizeLookupWord(word: string): string {
  return word.trim().replace(/\s+/gu, ' ');
}

/** Query orchestration is independent of transport and storage implementations. */
export function createDictionaryService(
  provider: DictionaryProvider,
  cache: DictionaryCache,
  clock: AppClock,
): DictionaryService {
  const pending = new Map<string, Promise<DictionaryLookupResult>>();
  const recentFailures = new Map<string, { until: number; value: DictionaryLookupResult }>();
  return {
    supports: (language) => provider.supports(language),
    lookup(word, language, retry = false) {
      if (!provider.supports(language)) return Promise.resolve({ status: 'unsupported' });
      const normalized = normalizeLookupWord(word);
      if (!normalized || normalized.length > 120) return Promise.resolve({ status: 'invalid' });
      const key = `${language.toLowerCase()}\0${normalized.toLocaleLowerCase('en')}`;
      const timestamp = clock.now().getTime();
      const cached = cache.get(key, timestamp);
      if (cached !== undefined)
        return Promise.resolve(
          cached ? { status: 'found', suggestion: cached } : { status: 'not-found' },
        );
      const existing = pending.get(key);
      if (existing) return existing;
      const failure = recentFailures.get(key);
      if (!retry && failure && timestamp < failure.until) return Promise.resolve(failure.value);
      recentFailures.delete(key);
      const request: Promise<DictionaryLookupResult> = Promise.resolve()
        .then(() => provider.lookup(normalized, language))
        .then((suggestion): DictionaryLookupResult => {
          cache.set(
            key,
            suggestion,
            clock.now().getTime(),
            suggestion ? FOUND_TTL_MS : NOT_FOUND_TTL_MS,
          );
          return suggestion ? { status: 'found', suggestion } : { status: 'not-found' };
        })
        .catch((error): DictionaryLookupResult => {
          if (error instanceof DictionaryProviderError && error.reason === 'not-found') {
            cache.set(key, null, clock.now().getTime(), NOT_FOUND_TTL_MS);
            return { status: 'not-found' };
          }
          const value: DictionaryLookupResult = {
            status: error instanceof DictionaryProviderError ? error.reason : 'unavailable',
          };
          recentFailures.set(key, { value, until: clock.now().getTime() + FAILURE_COOLDOWN_MS });
          while (recentFailures.size > 50)
            recentFailures.delete(recentFailures.keys().next().value!);
          return value;
        })
        .finally(() => pending.delete(key));
      pending.set(key, request);
      return request;
    },
  };
}
