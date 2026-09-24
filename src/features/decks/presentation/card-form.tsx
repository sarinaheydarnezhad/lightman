import { useRef, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';

import type { CreateCardInput } from '@/core/application/create-application';
import { MAX_CARD_TEXT_LENGTH } from '@/core/constants';
import { AppError } from '@/core/errors/app-error';
import type { Deck } from '@/features/decks/domain/deck';
import { validateCardContent, type Card, type CardExample } from '@/features/study/domain/card';
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
            }}
            error={frontError ?? undefined}
            placeholder="Term or vocabulary"
            maxLength={MAX_CARD_TEXT_LENGTH}
            returnKeyType="next"
            onSubmitEditing={() => phoneticRef.current?.focus()}
          />
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
