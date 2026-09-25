import { MAX_CARD_TEXT_LENGTH } from '@/core/constants';
import type { CardExample } from '@/features/study/domain/card';
import type { DictionaryMeaning } from '../domain/dictionary';

export interface SelectedDefinition extends DictionaryMeaning {
  readonly phonetic?: string;
}

export interface CardDraftFields {
  readonly meaning: string;
  readonly phonetic: string;
  readonly examples: readonly CardExample[];
}

export interface ImportChoices {
  readonly meaning: 'keep' | 'replace' | 'append';
  readonly phonetic: 'keep' | 'replace';
}

export function hasMeaningConflict(existing: string, suggestion: SelectedDefinition) {
  return !!existing.trim() && existing.trim() !== suggestion.definition.trim();
}

export function hasPhoneticConflict(existing: string, suggestion: SelectedDefinition) {
  return (
    !!suggestion.phonetic && !!existing.trim() && existing.trim() !== suggestion.phonetic.trim()
  );
}

export function canAppendMeaning(existing: string, definition: string) {
  return `${existing.trim()}\n\n${definition.trim()}`.length <= MAX_CARD_TEXT_LENGTH;
}

/** Operates on editable draft fields, preserves existing examples and their notes/translations. */
export function mergeSuggestion(
  draft: CardDraftFields,
  selection: SelectedDefinition,
  choices: ImportChoices,
): {
  readonly fields: CardDraftFields;
  readonly addedExamples: number;
  readonly limitedExamples: number;
} {
  const meaning = !draft.meaning.trim()
    ? selection.definition
    : choices.meaning === 'replace'
      ? selection.definition
      : choices.meaning === 'append' && canAppendMeaning(draft.meaning, selection.definition)
        ? `${draft.meaning.trim()}\n\n${selection.definition}`
        : draft.meaning;
  const phonetic =
    selection.phonetic && (!draft.phonetic.trim() || choices.phonetic === 'replace')
      ? selection.phonetic
      : draft.phonetic;
  const examples: CardExample[] = [...draft.examples];
  const seen = new Set(
    examples.map((example) => example.sentence.trim().replace(/\s+/gu, ' ').toLowerCase()),
  );
  let limitedExamples = 0;
  for (const sentence of selection.examples) {
    const normalized = sentence.trim().replace(/\s+/gu, ' ');
    if (!normalized || normalized.length > MAX_CARD_TEXT_LENGTH) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (examples.length < 20) examples.push({ sentence });
    else limitedExamples++;
  }
  return {
    fields: { meaning, phonetic, examples },
    addedExamples: examples.length - draft.examples.length,
    limitedExamples,
  };
}
