/** Provider-neutral vocabulary assistance. No provider payload or audio URL reaches a form. */
export interface DictionaryMeaning {
  readonly definition: string;
  readonly partOfSpeech?: string;
  readonly examples: readonly string[];
}

export interface NormalizedDictionarySuggestion {
  readonly word: string;
  readonly phonetic?: string;
  readonly meanings: readonly DictionaryMeaning[];
}

export type DictionaryLookupResult =
  | { readonly status: 'found'; readonly suggestion: NormalizedDictionarySuggestion }
  | {
      readonly status:
        | 'unsupported'
        | 'invalid'
        | 'not-found'
        | 'offline'
        | 'timeout'
        | 'rate-limited'
        | 'unavailable';
    };
