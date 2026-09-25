import type { NormalizedDictionarySuggestion } from './dictionary';

export type ProviderFailure = 'not-found' | 'offline' | 'timeout' | 'rate-limited' | 'unavailable';

export class DictionaryProviderError extends Error {
  constructor(public readonly reason: ProviderFailure) {
    super(reason);
  }
}

export interface DictionaryProvider {
  supports(language: string): boolean;
  lookup(word: string, language: string): Promise<NormalizedDictionarySuggestion | null>;
}

/** Small transport boundary: fetch never reaches a presentation module. */
export interface DictionaryHttpClient {
  get(url: string, signal: AbortSignal): Promise<DictionaryHttpResponse>;
}

export interface DictionaryHttpResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: Pick<Headers, 'get'>;
  text(): Promise<string>;
}
