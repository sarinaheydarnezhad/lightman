import { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, TextInput, View } from 'react-native';
import { Info } from 'lucide-react-native';

import type { CreateDeckInput } from '@/core/application/create-application';
import { application } from '@/core/composition/application';
import { supportedLanguageTag } from '@/core/domain/values';
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
import { Chip } from '@/shared/ui/chip';
import { Card } from '@/shared/ui/card';
import { IconButton } from '@/shared/ui/icon-button';
import { Input } from '@/shared/ui/input';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { languageChoices } from './deck-presentation';

type LanguageChoice = (typeof languageChoices)[number]['tag'];

export function DeckForm({
  existing,
  onSubmit,
}: {
  existing?: Deck;
  onSubmit: (values: CreateDeckInput) => Promise<void>;
}) {
  const { t, language, direction } = useLocalization();
  const optionRowStyle = {
    direction: 'ltr',
    flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
  } as const;
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const initialTag = existing?.language ?? 'en';
  const initialChoice = languageChoices.find(
    (choice) => initialTag.toLowerCase().split('-')[0] === choice.tag,
  );
  const [languageChoice, setLanguageChoice] = useState<LanguageChoice | null>(
    initialChoice?.tag ?? null,
  );
  const [alignment, setAlignment] = useState<DeckTextAlignment>(existing?.textAlignment ?? 'ltr');
  const [size, setSize] = useState<TypographySize>(existing?.typographySize ?? 'medium');
  const [reviewSystem, setReviewSystem] = useState(existing?.reviewSystem ?? 'leitner');
  const [reviewInfoVisible, setReviewInfoVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [languageError, setLanguageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const descriptionRef = useRef<TextInput>(null);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

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
    let validLanguage: ReturnType<typeof supportedLanguageTag>;
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
      validLanguage = supportedLanguageTag(languageChoice === initialChoice?.tag ? initialTag : languageChoice ?? initialTag);
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
        reviewSystem,
      });
    } catch (cause) {
      if (mounted.current) {
        setError(
          language === 'en' && cause instanceof AppError ? cause.message : t('form.deckSaveError'),
        );
      }
      void haptics.actionRejected();
    } finally {
      submitting.current = false;
      if (mounted.current) setSaving(false);
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
          <View className="flex-row flex-wrap gap-sm" style={optionRowStyle}>
            {languageChoices.map((choice) => (
              <Chip
                key={choice.tag}
                label={t(`language.${choice.tag}`)}
                selected={languageChoice === choice.tag}
                onPress={() => {
                  setLanguageChoice(choice.tag);
                  setLanguageError(null);
                }}
              />
            ))}
          </View>
          {languageError ? <Text tone="error" accessibilityLiveRegion="polite">{languageError}</Text> : null}
        </View>
        <View className="gap-sm">
          <Text variant="labelLarge">{t('form.alignment')}</Text>
          <View className="flex-row flex-wrap gap-sm" style={optionRowStyle}>
            {(['ltr', 'rtl', 'center'] as const).map((choice) => (
              <Chip
                key={choice}
                label={t(`form.alignment.${choice}`)}
                selected={alignment === choice}
                onPress={() => setAlignment(choice)}
              />
            ))}
          </View>
        </View>
        <View className="gap-sm">
          <Text variant="labelLarge">{t('form.size')}</Text>
          <View className="flex-row flex-wrap gap-sm" style={optionRowStyle}>
            {(['small', 'medium', 'large'] as const).map((choice) => (
              <Chip
                key={choice}
                label={t(`form.size.${choice}`)}
                selected={size === choice}
                onPress={() => setSize(choice)}
              />
            ))}
          </View>
        </View>
        <View className="gap-sm">
          <View className="flex-row items-center justify-between gap-sm" style={optionRowStyle}>
            <Text variant="labelLarge">{t('review.system')}</Text>
            <IconButton
              icon={Info}
              label={t('review.infoButton')}
              variant="ghost"
              onPress={() => setReviewInfoVisible(true)}
            />
          </View>
          <Text tone="secondary" variant="bodySmall">
            {t('review.deckHint')}
          </Text>
          <View className="flex-row flex-wrap gap-sm" style={optionRowStyle}>
            {application.listSchedulers().map((scheduler) => (
              <Chip
                key={scheduler.id}
                label={scheduler.localizedLabels?.[language] ?? scheduler.label}
                selected={reviewSystem === scheduler.id}
                onPress={() => setReviewSystem(scheduler.id)}
              />
            ))}
          </View>
        </View>
        <Modal
          visible={reviewInfoVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setReviewInfoVisible(false)}
        >
          <View className="flex-1 justify-center bg-overlay/60 p-lg" accessibilityViewIsModal>
            <Card variant="elevated" className="gap-md">
              <Text variant="headingSmall">{t('review.infoTitle')}</Text>
              {application.listSchedulers().map((scheduler) => (
                <View key={scheduler.id} className="gap-xs">
                  <Text variant="labelLarge">
                    {scheduler.localizedLabels?.[language] ?? scheduler.label}
                  </Text>
                  <Text tone="secondary">
                    {scheduler.id === 'sm2'
                      ? t('review.sm2Description')
                      : t('review.leitnerDescription')}
                  </Text>
                </View>
              ))}
              <Button
                label={t('review.infoClose')}
                variant="secondary"
                onPress={() => setReviewInfoVisible(false)}
              />
            </Card>
          </View>
        </Modal>
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
