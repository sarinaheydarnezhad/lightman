import { useRef, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';

import type { CreateCardInput } from '@/core/application/create-application';
import { MAX_CARD_TEXT_LENGTH } from '@/core/constants';
import { AppError } from '@/core/errors/app-error';
import { haptics } from '@/core/composition/haptics';
import type { Deck } from '@/features/decks/domain/deck';
import { validateCardContent, type Card, type CardExample } from '@/features/study/domain/card';
import {
  canAppendMeaning,
  hasMeaningConflict,
  hasPhoneticConflict,
  mergeSuggestion,
  type ImportChoices,
  type SelectedDefinition,
} from '@/features/vocabulary/application/merge-suggestion';
import { VocabularyHelper } from '@/features/vocabulary/presentation/vocabulary-helper';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { Card as Surface } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { CardContent } from './card-content';

export function CardForm({
  deck,
  existing,
  onSubmit,
}: {
  deck: Deck;
  existing?: Card;
  onSubmit: (content: Omit<CreateCardInput, 'deckId'>) => Promise<void>;
}) {
  const [frontText, setFrontText] = useState(existing?.frontText ?? '');
  const [phonetic, setPhonetic] = useState(existing?.phonetic ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [meaning, setMeaning] = useState(existing?.meaning ?? '');
  const [examples, setExamples] = useState<CardExample[]>(
    existing?.examples.map((item) => ({ ...item })) ?? [],
  );
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [frontError, setFrontError] = useState<string | null>(null);
  const [meaningError, setMeaningError] = useState<string | null>(null);
  const [exampleError, setExampleError] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<SelectedDefinition | null>(null);
  const [meaningChoice, setMeaningChoice] = useState<ImportChoices['meaning'] | null>(null);
  const [phoneticChoice, setPhoneticChoice] = useState<ImportChoices['phonetic'] | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const submitting = useRef(false);
  const phoneticRef = useRef<TextInput>(null);
  const categoryRef = useRef<TextInput>(null);
  const meaningRef = useRef<TextInput>(null);

  function changeExample(index: number, changes: Partial<CardExample>) {
    setExamples((current) =>
      current.map((item, position) => (position === index ? { ...item, ...changes } : item)),
    );
    setExampleError(null);
  }

  function applySuggestion() {
    if (!pendingSuggestion) return;
    const conflictMeaning = hasMeaningConflict(meaning, pendingSuggestion);
    const conflictPhonetic = hasPhoneticConflict(phonetic, pendingSuggestion);
    if (
      (conflictMeaning && !meaningChoice) ||
      (conflictPhonetic && !phoneticChoice) ||
      (meaningChoice === 'append' && !canAppendMeaning(meaning, pendingSuggestion.definition))
    )
      return;
    const result = mergeSuggestion({ meaning, phonetic, examples }, pendingSuggestion, {
      meaning: meaningChoice ?? 'keep',
      phonetic: phoneticChoice ?? 'keep',
    });
    const changed =
      result.fields.meaning !== meaning ||
      result.fields.phonetic !== phonetic ||
      result.addedExamples > 0;
    setMeaning(result.fields.meaning);
    setPhonetic(result.fields.phonetic);
    setExamples([...result.fields.examples]);
    setMeaningError(null);
    setExampleError(null);
    setImportMessage(
      `${changed ? 'Suggestion added. Review and save when ready.' : 'No new content was added.'}${result.limitedExamples ? ' The card has room for only 20 examples.' : ''}`,
    );
    setPendingSuggestion(null);
    if (changed) void haptics.actionConfirmed();
  }

  async function save() {
    if (submitting.current) return;
    setFrontError(null);
    setMeaningError(null);
    setExampleError(null);
    setError(null);
    if (!frontText.trim()) {
      setFrontError('Enter a term.');
      return;
    }
    if (!meaning.trim()) {
      setMeaningError('Enter a meaning.');
      return;
    }
    const emptyExample = examples.findIndex((item) => !item.sentence.trim());
    if (emptyExample !== -1) {
      setExampleError(emptyExample);
      return;
    }
    let content: ReturnType<typeof validateCardContent>;
    try {
      content = validateCardContent({ frontText, phonetic, category, meaning, examples });
    } catch (cause) {
      setError(cause instanceof AppError ? cause.message : 'Check the card content and try again.');
      return;
    }
    submitting.current = true;
    setSaving(true);
    Keyboard.dismiss();
    try {
      await onSubmit(content);
    } catch (cause) {
      setError(cause instanceof AppError ? cause.message : 'Unable to save this card. Try again.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <Screen scroll keyboardAware edges={stackScreenEdges}>
      <View className="gap-xl pb-3xl">
        <ScreenHeader
          title={existing ? 'Edit card' : 'Create a card'}
          description={`Add a term and its meaning to ${deck.name}.`}
        />
        <View className="gap-md">
          <Text variant="headingMedium" accessibilityRole="header">
            Front
          </Text>
          <Input
            label="Front text"
            value={frontText}
            onChangeText={(value) => {
              setFrontText(value);
              setFrontError(null);
              setPendingSuggestion(null);
              setImportMessage(null);
            }}
            error={frontError ?? undefined}
            placeholder="Term or vocabulary"
            maxLength={MAX_CARD_TEXT_LENGTH}
            returnKeyType="next"
            onSubmitEditing={() => phoneticRef.current?.focus()}
          />
          <VocabularyHelper
            key={`${deck.language}:${frontText}`}
            word={frontText}
            language={deck.language}
            textAlignment={deck.textAlignment}
            onSelect={(selection) => {
              setPendingSuggestion(selection);
              setMeaningChoice(null);
              setPhoneticChoice(null);
              setImportMessage(null);
            }}
          />
          {pendingSuggestion ? (
            <Surface className="gap-md" accessibilityLiveRegion="polite">
              <Text variant="headingSmall" accessibilityRole="header">
                Review suggestion
              </Text>
              <Text tone="secondary">{pendingSuggestion.definition}</Text>
              {hasMeaningConflict(meaning, pendingSuggestion) ? (
                <View className="gap-sm">
                  <Text>Existing meaning: {meaning}</Text>
                  <Text tone="secondary">
                    Choose how to handle the meaning you already entered.
                  </Text>
                  {(['keep', 'replace', 'append'] as const).map((choice) => (
                    <Button
                      key={choice}
                      label={`${choice[0]!.toUpperCase()}${choice.slice(1)} meaning`}
                      variant={meaningChoice === choice ? 'primary' : 'secondary'}
                      accessibilityState={{ selected: meaningChoice === choice }}
                      disabled={
                        choice === 'append' &&
                        !canAppendMeaning(meaning, pendingSuggestion.definition)
                      }
                      onPress={() => setMeaningChoice(choice)}
                    />
                  ))}
                </View>
              ) : null}
              {hasPhoneticConflict(phonetic, pendingSuggestion) ? (
                <View className="gap-sm">
                  <Text>Existing phonetic: {phonetic}</Text>
                  <Text tone="secondary">Choose which phonetic transcription to keep.</Text>
                  {(['keep', 'replace'] as const).map((choice) => (
                    <Button
                      key={choice}
                      label={`${choice[0]!.toUpperCase()}${choice.slice(1)} phonetic`}
                      variant={phoneticChoice === choice ? 'primary' : 'secondary'}
                      accessibilityState={{ selected: phoneticChoice === choice }}
                      onPress={() => setPhoneticChoice(choice)}
                    />
                  ))}
                </View>
              ) : null}
              <Text variant="bodySmall" tone="secondary">
                New example sentences will be added without replacing existing ones; duplicates are
                skipped. Part of speech is shown for context and is not a card field.
              </Text>
              <Button
                label="Apply suggestion"
                disabled={
                  (hasMeaningConflict(meaning, pendingSuggestion) && !meaningChoice) ||
                  (hasPhoneticConflict(phonetic, pendingSuggestion) && !phoneticChoice) ||
                  (meaningChoice === 'append' &&
                    !canAppendMeaning(meaning, pendingSuggestion.definition))
                }
                onPress={applySuggestion}
              />
              <Button
                label="Cancel suggestion"
                variant="tertiary"
                onPress={() => setPendingSuggestion(null)}
              />
            </Surface>
          ) : null}
          {importMessage ? (
            <Text tone="secondary" accessibilityLiveRegion="polite">
              {importMessage}
            </Text>
          ) : null}
          <Input
            ref={phoneticRef}
            label="Phonetic (optional)"
            value={phonetic}
            onChangeText={setPhonetic}
            maxLength={500}
            returnKeyType="next"
            onSubmitEditing={() => categoryRef.current?.focus()}
          />
          <Input
            ref={categoryRef}
            label="Category (optional)"
            value={category}
            onChangeText={setCategory}
            maxLength={120}
            returnKeyType="next"
            onSubmitEditing={() => meaningRef.current?.focus()}
          />
        </View>
        <View className="gap-md">
          <Text variant="headingMedium" accessibilityRole="header">
            Back
          </Text>
          <Input
            ref={meaningRef}
            label="Meaning"
            value={meaning}
            onChangeText={(value) => {
              setMeaning(value);
              setMeaningError(null);
            }}
            error={meaningError ?? undefined}
            multiline
            numberOfLines={4}
            maxLength={MAX_CARD_TEXT_LENGTH}
            placeholder="Meaning or definition"
          />
          <Text variant="labelLarge">Usage examples (optional)</Text>
          {examples.map((example, index) => (
            <Surface key={index} className="gap-md">
              <Text variant="labelLarge">Example {index + 1}</Text>
              <Input
                label={`Sentence ${index + 1}`}
                value={example.sentence}
                onChangeText={(value) => changeExample(index, { sentence: value })}
                error={
                  exampleError === index ? 'Enter a sentence or remove this example.' : undefined
                }
                maxLength={MAX_CARD_TEXT_LENGTH}
                multiline
                numberOfLines={3}
              />
              <Input
                label={`Translation ${index + 1} (optional)`}
                value={example.translation ?? ''}
                onChangeText={(value) => changeExample(index, { translation: value })}
                multiline
                numberOfLines={2}
              />
              <Input
                label={`Notes ${index + 1} (optional)`}
                value={example.notes ?? ''}
                onChangeText={(value) => changeExample(index, { notes: value })}
                multiline
                numberOfLines={2}
              />
              <Button
                label={`Remove example ${index + 1}`}
                variant="tertiary"
                onPress={() => {
                  setExamples((current) => current.filter((_, position) => position !== index));
                  setExampleError(null);
                }}
              />
            </Surface>
          ))}
          <Button
            label="Add example"
            variant="secondary"
            disabled={examples.length >= 20}
            onPress={() => setExamples((current) => [...current, { sentence: '' }])}
          />
        </View>
        <Button
          label={preview ? 'Hide preview' : 'Preview card'}
          variant="secondary"
          onPress={() => setPreview((value) => !value)}
        />
        {preview ? (
          <CardContent
            deck={deck}
            preview
            content={{
              frontText: frontText.trim(),
              phonetic: phonetic.trim(),
              category: category.trim(),
              meaning: meaning.trim(),
              examples: examples
                .filter((item) => item.sentence.trim())
                .map((item) => ({
                  sentence: item.sentence.trim(),
                  translation: item.translation?.trim(),
                  notes: item.notes?.trim(),
                })),
            }}
          />
        ) : null}
        {error ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button
          label={existing ? 'Save card' : 'Create card'}
          loading={saving}
          onPress={() => void save()}
        />
      </View>
    </Screen>
  );
}
