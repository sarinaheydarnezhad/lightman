import { useRef, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';

import type { CreateDeckInput } from '@/core/application/create-application';
import { languageTag } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import {
  validateDeckTitle,
  type Deck,
  type DeckTextAlignment,
  type TypographySize,
} from '@/features/decks/domain/deck';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { languageChoices } from './deck-presentation';

type LanguageChoice = (typeof languageChoices)[number]['tag'] | 'other';

export function DeckForm({
  existing,
  onSubmit,
}: {
  existing?: Deck;
  onSubmit: (values: CreateDeckInput) => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const initialTag = existing?.language ?? 'en';
  const initialChoice = languageChoices.find(
    (choice) => initialTag.toLowerCase().split('-')[0] === choice.tag,
  );
  const [languageChoice, setLanguageChoice] = useState<LanguageChoice>(
    initialChoice?.tag ?? 'other',
  );
  const [customLanguage, setCustomLanguage] = useState(initialChoice ? '' : initialTag);
  const [alignment, setAlignment] = useState<DeckTextAlignment>(existing?.textAlignment ?? 'ltr');
  const [size, setSize] = useState<TypographySize>(existing?.typographySize ?? 'medium');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [languageError, setLanguageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const descriptionRef = useRef<TextInput>(null);

  async function save() {
    if (saving) return;
    setNameError(null);
    setLanguageError(null);
    setError(null);
    if (!name.trim()) {
      setNameError('Enter a deck name.');
      return;
    }
    let validName: string;
    let validLanguage: ReturnType<typeof languageTag>;
    try {
      validName = validateDeckTitle(name);
    } catch (cause) {
      setNameError(cause instanceof AppError ? cause.message : 'Enter a deck name.');
      return;
    }
    try {
      validLanguage = languageTag(
        languageChoice === 'other'
          ? customLanguage
          : languageChoice === initialChoice?.tag
            ? initialTag
            : languageChoice,
      );
    } catch {
      setLanguageError('Enter a valid language tag, such as es or fr-CA.');
      return;
    }
    Keyboard.dismiss();
    setSaving(true);
    try {
      await onSubmit({
        name: validName,
        description: description.trim(),
        language: validLanguage,
        textAlignment: alignment,
        typographySize: size,
      });
    } catch (cause) {
      setError(cause instanceof AppError ? cause.message : 'Unable to save this deck. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll keyboardAware edges={stackScreenEdges}>
      <View className="gap-xl pb-3xl">
        <ScreenHeader
          title={existing ? `Edit ${existing.name}` : 'Create a deck'}
          description="Give your deck a name and choose how its content reads."
        />
        <View className="gap-md">
          <Input
            label="Deck name"
            value={name}
            onChangeText={(value) => {
              setName(value);
              setNameError(null);
            }}
            error={nameError ?? undefined}
            maxLength={121}
            returnKeyType="next"
            onSubmitEditing={() => descriptionRef.current?.focus()}
            autoFocus={!existing}
          />
          <Input
            ref={descriptionRef}
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={1000}
            placeholder="What will you collect here?"
          />
        </View>
        <View className="gap-sm">
          <Text variant="labelLarge">Language</Text>
          <Text tone="secondary" variant="bodySmall">
            Choose the main language for this deck.
          </Text>
          <View className="flex-row flex-wrap gap-sm">
            {([...languageChoices, { label: 'Other', tag: 'other' }] as const).map((choice) => (
              <Button
                key={choice.tag}
                label={choice.label}
                variant={languageChoice === choice.tag ? 'primary' : 'secondary'}
                accessibilityState={{ selected: languageChoice === choice.tag }}
                onPress={() => {
                  setLanguageChoice(choice.tag);
                  setLanguageError(null);
                }}
              />
            ))}
          </View>
          {languageChoice === 'other' ? (
            <Input
              label="Language tag"
              helperText="For example, es or fr-CA"
              error={languageError ?? undefined}
              value={customLanguage}
              onChangeText={(value) => {
                setCustomLanguage(value);
                setLanguageError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          ) : null}
        </View>
        <View className="gap-sm">
          <Text variant="labelLarge">Text alignment</Text>
          <View className="flex-row flex-wrap gap-sm">
            {(['ltr', 'rtl', 'center'] as const).map((choice) => (
              <Button
                key={choice}
                label={choice.toUpperCase()}
                variant={alignment === choice ? 'primary' : 'secondary'}
                accessibilityState={{ selected: alignment === choice }}
                onPress={() => setAlignment(choice)}
              />
            ))}
          </View>
        </View>
        <View className="gap-sm">
          <Text variant="labelLarge">Typography size</Text>
          <View className="flex-row flex-wrap gap-sm">
            {(['small', 'medium', 'large'] as const).map((choice) => (
              <Button
                key={choice}
                label={choice.charAt(0).toUpperCase() + choice.slice(1)}
                variant={size === choice ? 'primary' : 'secondary'}
                accessibilityState={{ selected: size === choice }}
                onPress={() => setSize(choice)}
              />
            ))}
          </View>
        </View>
        {error ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Button
          label={existing ? 'Save deck' : 'Create deck'}
          loading={saving}
          onPress={() => void save()}
        />
      </View>
    </Screen>
  );
}
