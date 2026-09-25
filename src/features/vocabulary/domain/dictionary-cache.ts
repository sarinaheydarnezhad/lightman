import type { NormalizedDictionarySuggestion } from './dictionary';

export interface DictionaryCache {
  get(key: string, timestamp: number): NormalizedDictionarySuggestion | null | undefined;
  set(
    key: string,
    value: NormalizedDictionarySuggestion | null,
    timestamp: number,
    ttlMs: number,
  ): void;
}
