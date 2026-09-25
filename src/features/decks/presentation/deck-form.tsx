import { useRef, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';

import type { CreateDeckInput } from '@/core/application/create-application';
import { languageTag } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import { haptics } from '@/core/composition/haptics';
import {
  validateDeckTitle,
  type Deck,
  type DeckTextAlignment,
  type TypographySize,
} from '@/features/decks/domain/deck';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { useLocalization } from '@/shared/localization/localization-provider';
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
  const { t, language } = useLocalization();
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
  const submitting = useRef(false);
  const descriptionRef = useRef<TextInput>(null);

  async function save() {
    if (submitting.current) return;
    setNameError(null);
    setLanguageError(null);
    setError(null);
    if (!name.trim()) {
      setNameError(t('form.deckNameRequired'));
      void haptics.actionRejected();
      return;
    }
    let validName: string;
    let validLanguage: ReturnType<typeof languageTag>;
    try {
      validName = validateDeckTitle(name);
    } catch (cause) {
      setNameError(
        language === 'en' && cause instanceof AppError ? cause.message : t('form.deckNameRequired'),
      );
      void haptics.actionRejected();
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
      setLanguageError(t('form.languageInvalid'));
      void haptics.actionRejected();
      return;
    }
    submitting.current = true;
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
      setError(
        language === 'en' && cause instanceof AppError ? cause.message : t('form.deckSaveError'),
      );
      void haptics.actionRejected();
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <Screen scroll keyboardAware edges={stackScreenEdges}>
      <View className="gap-xl pb-3xl">
        <ScreenHeader
          title={existing ? t('form.editDeck', { name: existing.name }) : t('form.createDeck')}
          description={t('form.deckHint')}
        />
        <View className="gap-md">
          <Input
            label={t('form.deckName')}
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
            label={t('form.description')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={1000}
            placeholder={t('form.descriptionPlaceholder')}
          />
        </View>
        <View className="gap-sm">
          <Text variant="labelLarge">{t('form.language')}</Text>
          <Text tone="secondary" variant="bodySmall">
            {t('form.languageHint')}
          </Text>
          <View className="flex-row flex-wrap gap-sm">
            {([...languageChoices, { label: 'Other', tag: 'other' }] as const).map((choice) => (
              <Button
                key={choice.tag}
                label={choice.tag === 'other' ? t('form.other') : t(`language.${choice.tag}`)}
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
              label={t('form.languageTag')}
              helperText={t('form.languageTagHint')}
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
          <Text variant="labelLarge">{t('form.alignment')}</Text>
          <View className="flex-row flex-wrap gap-sm">
            {(['ltr', 'rtl', 'center'] as const).map((choice) => (
              <Button
                key={choice}
                label={t(`form.alignment.${choice}`)}
                variant={alignment === choice ? 'primary' : 'secondary'}
                accessibilityState={{ selected: alignment === choice }}
                onPress={() => setAlignment(choice)}
              />
            ))}
          </View>
        </View>
        <View className="gap-sm">
          <Text variant="labelLarge">{t('form.size')}</Text>
          <View className="flex-row flex-wrap gap-sm">
            {(['small', 'medium', 'large'] as const).map((choice) => (
              <Button
                key={choice}
                label={t(`form.size.${choice}`)}
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
          label={t(existing ? 'form.saveDeck' : 'form.createDeckAction')}
          loading={saving}
          onPress={() => void save()}
        />
      </View>
    </Screen>
  );
}
