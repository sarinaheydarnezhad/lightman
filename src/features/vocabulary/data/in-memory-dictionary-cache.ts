import type { NormalizedDictionarySuggestion } from '../domain/dictionary';
import type { DictionaryCache } from '../domain/dictionary-cache';

function copy(value: NormalizedDictionarySuggestion | null) {
  if (!value) return null;
  return {
    ...value,
    meanings: value.meanings.map((meaning) => ({ ...meaning, examples: [...meaning.examples] })),
  };
}

/** Temporary, bounded LRU cache; positive/negative TTL is selected by the service. */
export function createInMemoryDictionaryCache(maxEntries = 50): DictionaryCache {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) throw new Error('Invalid cache size.');
  const entries = new Map<
    string,
    { readonly value: NormalizedDictionarySuggestion | null; readonly expiresAt: number }
  >();
  return {
    get(key, timestamp) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= timestamp) {
        entries.delete(key);
        return undefined;
      }
      entries.delete(key);
      entries.set(key, entry);
      return copy(entry.value);
    },
    set(key, value, timestamp, ttlMs) {
      entries.delete(key);
      entries.set(key, { value: copy(value), expiresAt: timestamp + ttlMs });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
    },
  };
}
