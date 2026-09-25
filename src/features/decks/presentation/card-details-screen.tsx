import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { View } from 'react-native';

import { AppError } from '@/core/errors/app-error';
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
  const { archive: archiveCard } = useCardActions();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const submitting = useRef(false);

  async function archive() {
    if (submitting.current) return;
    submitting.current = true;
    setArchiving(true);
    setActionError(null);
    try {
      await archiveCard(cardId);
      router.dismissTo({ pathname: '/decks/[deckId]/cards', params: { deckId } });
    } catch (cause) {
      setActionError(
        language === 'en' && cause instanceof AppError
          ? cause.message
          : t('details.cardArchiveError'),
      );
      submitting.current = false;
      setArchiving(false);
    }
  }

  if (loading && !data)
    return (
      <FeaturePlaceholder
        title={t('details.cardLoading')}
        description={t('details.cardLoadingHint')}
      >
        <LoadingState label={t('details.cardLoading')} />
      </FeaturePlaceholder>
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
      >
        <Button label={t('common.tryAgain')} onPress={refresh} />
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
          pointerEvents={confirmArchive ? 'none' : 'auto'}
          accessibilityElementsHidden={confirmArchive}
          importantForAccessibility={confirmArchive ? 'no-hide-descendants' : 'auto'}
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
            label={t('details.archiveCard')}
            variant="tertiary"
            onPress={() => setConfirmArchive(true)}
          />
        </View>
        {confirmArchive ? (
          <ConfirmationPanel
            title={t('details.archiveCardTitle')}
            description={t('details.archiveCardHint')}
            cancelLabel={t('details.keepCard')}
            confirmLabel={t('details.confirmArchive')}
            busy={archiving}
            error={actionError}
            onCancel={() => {
              setConfirmArchive(false);
              setActionError(null);
            }}
            onConfirm={() => void archive()}
          />
        ) : null}
      </View>
    </Screen>
  );
}
