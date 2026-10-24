import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FeedbackModal } from '@/shared/ui/feedback-modal';
import { Keyboard, TextInput, View } from 'react-native';
import { Check } from 'lucide-react-native';

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
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/chip';
import { Card as Surface } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { IconButton } from '@/shared/ui/icon-button';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { CardContent } from './card-content';
import { deckContentStyle } from './deck-presentation';

export function CardForm({
  deck,
  existing,
  onSubmit,
  renderSaveAction,
}: {
  deck: Deck;
  existing?: Card;
  onSubmit: (content: Omit<CreateCardInput, 'deckId'>) => Promise<void>;
  renderSaveAction?: (action: ReactNode) => ReactNode;
}) {
  const { t, number, language } = useLocalization();
  const [frontText, setFrontText] = useState(existing?.frontText ?? '');
  const [phonetic, setPhonetic] = useState(existing?.phonetic ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [meaning, setMeaning] = useState(existing?.meaning ?? '');
  const [examples, setExamples] = useState<CardExample[]>(
    existing?.examples.map((item) => ({ ...item })) ?? [],
  );
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [frontError, setFrontError] = useState<string | null>(null);
  const [meaningError, setMeaningError] = useState<string | null>(null);
  const [exampleError, setExampleError] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<SelectedDefinition | null>(null);
  const [meaningChoice, setMeaningChoice] = useState<ImportChoices['meaning'] | null>(null);
  const [phoneticChoice, setPhoneticChoice] = useState<ImportChoices['phonetic'] | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const phoneticRef = useRef<TextInput>(null);
  const categoryRef = useRef<TextInput>(null);
  const meaningRef = useRef<TextInput>(null);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

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
      `${t(changed ? 'form.suggestionAdded' : 'form.suggestionUnchanged')}${result.limitedExamples ? ` ${t('form.examplesLimit')}` : ''}`,
    );
    setPendingSuggestion(null);
    if (changed) void haptics.actionConfirmed();
  }

  async function save() {
    if (submitting.current) return;
    setCreated(false);
    setFrontError(null);
    setMeaningError(null);
    setExampleError(null);
    setError(null);
    if (!frontText.trim()) {
      setFrontError(t('form.termRequired'));
      void haptics.actionRejected();
      return;
    }
    if (!meaning.trim()) {
      setMeaningError(t('form.meaningRequired'));
      void haptics.actionRejected();
      return;
    }
    const emptyExample = examples.findIndex((item) => !item.sentence.trim());
    if (emptyExample !== -1) {
      setExampleError(emptyExample);
      void haptics.actionRejected();
      return;
    }
    let content: ReturnType<typeof validateCardContent>;
    try {
      content = validateCardContent({ frontText, phonetic, category, meaning, examples });
    } catch (cause) {
      setError(
        language === 'en' && cause instanceof AppError ? cause.message : t('form.cardInvalid'),
      );
      void haptics.actionRejected();
      return;
    }
    submitting.current = true;
    setSaving(true);
    Keyboard.dismiss();
    try {
      await onSubmit(content);
      if (mounted.current && !existing) {
        setFrontText('');
        setPhonetic('');
        setCategory('');
        setMeaning('');
        setExamples([]);
        setPreview(false);
        setPendingSuggestion(null);
        setMeaningChoice(null);
        setPhoneticChoice(null);
        setImportMessage(null);
        setCreated(true);
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof AppError && cause.code === 'free-tier-limit'
            ? t('guest.cardLimit')
            : language === 'en' && cause instanceof AppError
              ? cause.message
              : t('form.cardSaveError'),
        );
      }
      void haptics.actionRejected();
    } finally {
      submitting.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  const saveButton = (
    <IconButton
      icon={Check}
      strokeWidth={3}
      label={t(existing ? 'form.saveCard' : 'form.createCardAction')}
      variant="ghost"
      tone="success"
      loading={saving}
      onPress={() => void save()}
    />
  );
  const renderHeaderAction = existing ? undefined : renderSaveAction;

  return (
    <Screen
      scroll
      keyboardAware
      edges={stackScreenEdges}
      header={
        <View className="gap-md">
          {renderHeaderAction?.(saveButton)}
          <View style={{ flexDirection: 'row', direction: 'ltr', alignItems: 'flex-start' }}>
            <View className="flex-1">
              <ScreenHeader
                title={t(existing ? 'form.editCard' : 'form.createCard')}
                description={t('form.cardHint', { name: deck.name })}
              />
            </View>
            {renderHeaderAction ? null : saveButton}
          </View>
          {created ? (
            <FeedbackModal message={t('form.cardCreated')} tone="success" onDismiss={() => setCreated(false)} />
          ) : null}
          {error ? (
            <FeedbackModal message={error} onDismiss={() => setError(null)} />
          ) : null}
        </View>
      }
    >
      <View className="gap-xl pb-3xl">
        <View className="gap-md">
          <Text variant="headingMedium" accessibilityRole="header">
            {t('form.front')}
          </Text>
          <Input
            label={t('form.frontText')}
            style={deckContentStyle(frontText || language, deck.textAlignment)}
            value={frontText}
            onChangeText={(value) => {
              setFrontText(value);
              setFrontError(null);
              setPendingSuggestion(null);
              setImportMessage(null);
            }}
            error={frontError ?? undefined}
            onDismissError={() => setFrontError(null)}
            placeholder={t('form.frontPlaceholder')}
            maxLength={MAX_CARD_TEXT_LENGTH}
            returnKeyType="next"
            onSubmitEditing={() => meaningRef.current?.focus()}
          />
        </View>
        <View className="gap-md">
          <Text variant="headingMedium" accessibilityRole="header">
            {t('form.back')}
          </Text>
          <Input
            ref={meaningRef}
            label={t('form.meaning')}
            style={deckContentStyle(meaning || language, deck.textAlignment)}
            value={meaning}
            onChangeText={(value) => {
              setMeaning(value);
              setMeaningError(null);
            }}
            error={meaningError ?? undefined}
            onDismissError={() => setMeaningError(null)}
            multiline
            numberOfLines={4}
            maxLength={MAX_CARD_TEXT_LENGTH}
            placeholder={t('form.meaningPlaceholder')}
          />
        </View>
        <View className="gap-md">
          <Text variant="headingMedium" accessibilityRole="header">
            {t('form.optionalDetails')}
          </Text>
          <View style={existing ? undefined : { display: 'none' }}>
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
          </View>
          {pendingSuggestion ? (
            <Surface className="gap-md" accessibilityLiveRegion="polite">
              <Text variant="headingSmall" accessibilityRole="header">
                {t('form.reviewSuggestion')}
              </Text>
              <Text tone="secondary">{pendingSuggestion.definition}</Text>
              {hasMeaningConflict(meaning, pendingSuggestion) ? (
                <View className="gap-sm">
                  <Text>{t('form.existingMeaning', { value: meaning })}</Text>
                  <Text tone="secondary">{t('form.meaningConflict')}</Text>
                  {(['keep', 'replace', 'append'] as const).map((choice) => (
                    <Chip
                      key={choice}
                      label={t(
                        choice === 'keep'
                          ? 'form.keepMeaning'
                          : choice === 'replace'
                            ? 'form.replaceMeaning'
                            : 'form.appendMeaning',
                      )}
                      selected={meaningChoice === choice}
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
                  <Text>{t('form.existingPhonetic', { value: phonetic })}</Text>
                  <Text tone="secondary">{t('form.phoneticConflict')}</Text>
                  {(['keep', 'replace'] as const).map((choice) => (
                    <Chip
                      key={choice}
                      label={t(choice === 'keep' ? 'form.keepPhonetic' : 'form.replacePhonetic')}
                      selected={phoneticChoice === choice}
                      onPress={() => setPhoneticChoice(choice)}
                    />
                  ))}
                </View>
              ) : null}
              <Text variant="bodySmall" tone="secondary">
                {t('form.suggestionHint')}
              </Text>
              <Button
                label={t('form.applySuggestion')}
                disabled={
                  (hasMeaningConflict(meaning, pendingSuggestion) && !meaningChoice) ||
                  (hasPhoneticConflict(phonetic, pendingSuggestion) && !phoneticChoice) ||
                  (meaningChoice === 'append' &&
                    !canAppendMeaning(meaning, pendingSuggestion.definition))
                }
                onPress={applySuggestion}
              />
              <Button
                label={t('form.cancelSuggestion')}
                variant="tertiary"
                onPress={() => setPendingSuggestion(null)}
              />
            </Surface>
          ) : null}
          {importMessage ? (
            <FeedbackModal message={importMessage} tone="info" onDismiss={() => setImportMessage(null)} />
          ) : null}
          <Input
            ref={phoneticRef}
            label={t('form.phonetic')}
            style={deckContentStyle(phonetic || deck.language, deck.textAlignment)}
            value={phonetic}
            onChangeText={setPhonetic}
            maxLength={500}
            returnKeyType="next"
            onSubmitEditing={() => categoryRef.current?.focus()}
          />
          <Input
            ref={categoryRef}
            label={t('form.category')}
            style={deckContentStyle(category || deck.language, deck.textAlignment)}
            value={category}
            onChangeText={setCategory}
            maxLength={120}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>
        <View className="gap-md">
          <Text variant="labelLarge">{t('form.examples')}</Text>
          {examples.map((example, index) => (
            <Surface key={index} className="gap-md">
              <Text variant="labelLarge">{t('form.example', { number: number(index + 1) })}</Text>
              <Input
                label={t('form.sentence', { number: number(index + 1) })}
                style={deckContentStyle(example.sentence || deck.language, deck.textAlignment)}
                value={example.sentence}
                onChangeText={(value) => changeExample(index, { sentence: value })}
                error={exampleError === index ? t('form.sentenceRequired') : undefined}
                onDismissError={() => setExampleError(null)}
                maxLength={MAX_CARD_TEXT_LENGTH}
                multiline
                numberOfLines={3}
              />
              <Input
                label={t('form.translation', { number: number(index + 1) })}
                style={deckContentStyle(
                  (example.translation ?? '') || deck.language,
                  deck.textAlignment,
                )}
                value={example.translation ?? ''}
                onChangeText={(value) => changeExample(index, { translation: value })}
                multiline
                numberOfLines={2}
              />
              <Input
                label={t('form.notes', { number: number(index + 1) })}
                style={deckContentStyle((example.notes ?? '') || deck.language, deck.textAlignment)}
                value={example.notes ?? ''}
                onChangeText={(value) => changeExample(index, { notes: value })}
                multiline
                numberOfLines={2}
              />
              <Button
                label={t('form.removeExample', { number: number(index + 1) })}
                variant="tertiary"
                onPress={() => {
                  setExamples((current) => current.filter((_, position) => position !== index));
                  setExampleError(null);
                }}
              />
            </Surface>
          ))}
          <Button
            label={t('form.addExample')}
            variant="secondary"
            disabled={examples.length >= 20}
            onPress={() => setExamples((current) => [...current, { sentence: '' }])}
          />
        </View>
        <Button
          label={t(preview ? 'form.hidePreview' : 'form.preview')}
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
      </View>
    </Screen>
  );
}
