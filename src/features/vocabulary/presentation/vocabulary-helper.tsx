import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { vocabularyHelper } from '@/core/composition/vocabulary';
import type { DeckTextAlignment } from '@/features/decks/domain/deck';
import type { DictionaryLookupResult, DictionaryMeaning } from '../domain/dictionary';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import type { SelectedDefinition } from '../application/merge-suggestion';

const messages: Record<Exclude<DictionaryLookupResult['status'], 'found'>, string> = {
  unsupported: "Dictionary help isn't available for this language yet.",
  invalid: 'Enter a term of 120 characters or fewer to find suggestions.',
  'not-found': 'No definition found.',
  offline: 'You appear to be offline. Manual entry is still available.',
  timeout: 'Dictionary service timed out. Manual entry is still available.',
  'rate-limited': 'Dictionary service is busy. Please try again later.',
  unavailable: 'Dictionary service is unavailable. Manual entry is still available.',
};

export function VocabularyHelper({
  word,
  language,
  textAlignment,
  onSelect,
}: {
  word: string;
  language: string;
  textAlignment: DeckTextAlignment;
  onSelect: (selection: SelectedDefinition) => void;
}) {
  const [result, setResult] = useState<DictionaryLookupResult | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retried, setRetried] = useState(false);
  const request = useRef(0);
  const loadingRef = useRef(false);
  useEffect(() => {
    const token = request;
    return () => {
      ++token.current;
    };
  }, []);

  const supported = vocabularyHelper.supports(language);
  async function lookup(retry = false) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const current = ++request.current;
    setOpen(true);
    setLoading(true);
    setResult(null);
    if (retry) setRetried(true);
    try {
      const found = await vocabularyHelper.lookup(word, language, retry);
      if (request.current === current) setResult(found);
    } catch {
      if (request.current === current) setResult({ status: 'unavailable' });
    } finally {
      if (request.current === current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }

  return (
    <Card className="gap-md">
      <Text variant="headingSmall" accessibilityRole="header">
        Vocabulary helper
      </Text>
      {!supported ? (
        <Text tone="secondary">{messages.unsupported}</Text>
      ) : (
        <>
          <Text variant="bodySmall" tone="secondary">
            Optional. Finding suggestions sends this term to Free Dictionary API. You can still
            enter or save the card without it.
          </Text>
          <Button
            label="Find suggestions"
            variant="secondary"
            disabled={loading || !word.trim()}
            onPress={() => void lookup()}
          />
          {open ? (
            <>
              <Button
                label="Hide suggestions"
                variant="tertiary"
                onPress={() => {
                  ++request.current;
                  setOpen(false);
                  setLoading(false);
                  loadingRef.current = false;
                }}
              />
              {loading ? (
                <Text accessibilityLiveRegion="polite" accessibilityRole="text">
                  Finding dictionary suggestions…
                </Text>
              ) : result?.status === 'found' ? (
                <View className="gap-md" accessibilityLiveRegion="polite">
                  <Text
                    variant="labelLarge"
                    style={{ writingDirection: textAlignment === 'rtl' ? 'rtl' : 'ltr' }}
                  >
                    {result.suggestion.word}
                    {result.suggestion.phonetic ? ` · ${result.suggestion.phonetic}` : ''}
                  </Text>
                  {result.suggestion.meanings.map((meaning, index) => (
                    <DefinitionChoice
                      key={`${index}-${meaning.definition}`}
                      meaning={meaning}
                      index={index}
                      alignment={textAlignment}
                      onPress={() => {
                        onSelect({ ...meaning, phonetic: result.suggestion.phonetic });
                        setOpen(false);
                      }}
                    />
                  ))}
                </View>
              ) : result ? (
                <View className="gap-sm" accessibilityLiveRegion="polite">
                  <Text tone="secondary">{messages[result.status]}</Text>
                  {!retried &&
                  ['offline', 'timeout', 'rate-limited', 'unavailable'].includes(result.status) ? (
                    <Button
                      label="Retry suggestions"
                      variant="secondary"
                      onPress={() => void lookup(true)}
                    />
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </Card>
  );
}

function DefinitionChoice({
  meaning,
  index,
  alignment,
  onPress,
}: {
  meaning: DictionaryMeaning;
  index: number;
  alignment: DeckTextAlignment;
  onPress: () => void;
}) {
  const direction = { writingDirection: alignment === 'rtl' ? ('rtl' as const) : ('ltr' as const) };
  return (
    <Card variant="outlined" className="gap-sm">
      {meaning.partOfSpeech ? (
        <Text variant="labelMedium" tone="secondary">
          {meaning.partOfSpeech}
        </Text>
      ) : null}
      <Text style={direction}>{meaning.definition}</Text>
      {meaning.examples.map((sample, index) => (
        <Text key={`${index}-${sample}`} variant="bodySmall" tone="secondary" style={direction}>
          {sample}
        </Text>
      ))}
      <Button
        label={`Use this definition ${index + 1}`}
        accessibilityHint={`Definition: ${meaning.definition.slice(0, 160)}`}
        variant="secondary"
        onPress={onPress}
      />
    </Card>
  );
}
