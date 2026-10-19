import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { View } from 'react-native';

import { AppError } from '@/core/errors/app-error';
import { haptics } from '@/core/composition/haptics';
import { useLocalization } from '@/shared/localization/localization-provider';
import { speech } from '@/core/composition/speech';
import { PronunciationButton } from '@/shared/speech/pronunciation-button';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { ConfirmationPanel } from '@/shared/ui/confirmation-panel';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { CardContent } from './card-content';
import { useCardActions, useCardDetailsViewModel } from './use-cards-view-model';

export function CardDetailsScreen({ deckId, cardId }: { deckId: string; cardId: string }) {
  const { t, language } = useLocalization();
  useFocusEffect(useCallback(() => () => void speech.stop(), []));
  const { data, loading, error, refresh } = useCardDetailsViewModel(cardId, deckId);
  const { remove: deleteCard } = useCardActions();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  async function remove() {
    if (submitting.current) return;
    submitting.current = true;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteCard(cardId);
      if (!mounted.current) return;
      void haptics.actionConfirmed();
      router.dismissTo({ pathname: '/decks/[deckId]/cards', params: { deckId } });
    } catch (cause) {
      if (mounted.current) {
        setActionError(
          language === 'en' && cause instanceof AppError
            ? cause.message
            : t('details.cardDeleteError'),
        );
      }
      void haptics.actionRejected();
      submitting.current = false;
      if (mounted.current) setDeleting(false);
    }
  }

  if (loading && !data)
    return (
      <Screen edges={stackScreenEdges}>
        <LoadingState label={t('details.cardLoading')} />
      </Screen>
    );
  if (!data || error)
    return (
      <FeaturePlaceholder
        title={t('details.cardUnavailable')}
        description={
          language === 'en'
            ? (error ?? t('details.cardUnavailableHint'))
            : t('details.cardUnavailableHint')
        }
        onRetry={refresh}
      >
        <Button
          label={t('details.viewCards')}
          variant="secondary"
          onPress={() =>
            router.replace({
              pathname: '/decks/[deckId]/cards',
              params: { deckId },
            })
          }
        />
      </FeaturePlaceholder>
    );

  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-2xl pb-3xl">
        <View
          className="gap-2xl"
          pointerEvents={confirmDelete ? 'none' : 'auto'}
          accessibilityElementsHidden={confirmDelete}
          importantForAccessibility={confirmDelete ? 'no-hide-descendants' : 'auto'}
        >
          <ScreenHeader
            title={data.card.frontText}
            description={t('details.fromDeck', { name: data.deck.name })}
          />
          <CardContent deck={data.deck} content={data.card} />
          <View className="items-start">
            <PronunciationButton text={data.card.frontText} language={data.deck.language} />
          </View>
          <Button
            label={t('details.editCard')}
            onPress={() =>
              router.push({
                pathname: '/decks/[deckId]/cards/[cardId]/edit',
                params: { deckId, cardId },
              })
            }
          />
          <Button
            label={t('details.deleteCard')}
            variant="destructive"
            onPress={() => setConfirmDelete(true)}
          />
        </View>
        {confirmDelete ? (
          <ConfirmationPanel
            title={t('details.deleteCardTitle')}
            description={t('details.deleteCardHint')}
            cancelLabel={t('details.keepCard')}
            confirmLabel={t('details.confirmDelete')}
            busy={deleting}
            error={actionError}
            onCancel={() => {
              setConfirmDelete(false);
              setActionError(null);
            }}
            onConfirm={() => void remove()}
          />
        ) : null}
      </View>
    </Screen>
  );
}
