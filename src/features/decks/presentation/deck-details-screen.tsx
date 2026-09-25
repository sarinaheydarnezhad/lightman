import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';

import { AppError } from '@/core/errors/app-error';
import { useLocalization } from '@/shared/localization/localization-provider';
import { deckLanguageLabel } from '@/shared/localization/localization';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { ConfirmationPanel } from '@/shared/ui/confirmation-panel';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { deckAlignment, deckTypography } from './deck-presentation';
import { useDeckActions, useDeckDetailsViewModel } from './use-decks-view-model';
import { useStartStudy, openStudySession } from '@/features/study/presentation/use-start-study';

export function DeckDetailsScreen({ deckId }: { deckId: string }) {
  const { t, number, language } = useLocalization();
  const { data, loading, error, refresh } = useDeckDetailsViewModel(deckId);
  const actions = useDeckActions();
  const study = useStartStudy();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const deck = data?.deck;

  async function archive() {
    if (archiving) return;
    setArchiving(true);
    setActionError(null);
    try {
      await actions.archive(deckId);
      router.replace('/decks');
    } catch (cause) {
      setActionError(
        language === 'en' && cause instanceof AppError
          ? cause.message
          : t('details.deckArchiveError'),
      );
      setArchiving(false);
    }
  }

  if (loading && !data)
    return (
      <Screen edges={stackScreenEdges}>
        <LoadingState label={t('details.deckLoading')} />
      </Screen>
    );

  if (!deck || error) {
    return (
      <FeaturePlaceholder
        title={t('details.deckUnavailable')}
        description={
          language === 'en'
            ? (error ?? t('details.deckUnavailableHint'))
            : t('details.deckUnavailableHint')
        }
      >
        <Button label={t('common.tryAgain')} onPress={refresh} />
        <Button label={t('common.browseDecks')} onPress={() => router.replace('/decks')} />
      </FeaturePlaceholder>
    );
  }

  const contentStyle = {
    textAlign: deckAlignment[deck.textAlignment],
    writingDirection: deck.textAlignment === 'rtl' ? ('rtl' as const) : ('ltr' as const),
  };

  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-2xl pb-3xl">
        <View
          className="gap-2xl"
          pointerEvents={confirmArchive ? 'none' : 'auto'}
          accessibilityElementsHidden={confirmArchive}
          importantForAccessibility={confirmArchive ? 'no-hide-descendants' : 'auto'}
        >
          <ScreenHeader title={deck.name} description={deck.description} />
          <Card className="gap-md">
            <Badge
              label={t(data.cardCount === 1 ? 'common.singleCard' : 'common.cardCount', {
                count: number(data.cardCount),
              })}
            />
            <Text variant="labelLarge">{t('details.deckSettings')}</Text>
            <Text tone="secondary">
              {deckLanguageLabel(deck.language, language)} ·{' '}
              {t(`form.alignment.${deck.textAlignment}`)} · {t(`form.size.${deck.typographySize}`)}
            </Text>
            <Text tone="tertiary" variant="caption">
              {t('details.createdUpdated', {
                created: deck.createdAt.slice(0, 10),
                updated: deck.updatedAt.slice(0, 10),
              })}
            </Text>
          </Card>
          <Card className="gap-sm">
            <Text variant="labelLarge">{t('details.readingPreview')}</Text>
            <Text variant={deckTypography[deck.typographySize]} style={contentStyle}>
              {deck.name}
            </Text>
          </Card>
          <View className="gap-md">
            <Text variant="headingMedium" accessibilityRole="header">
              {t('nav.cards')}
            </Text>
            {data.cardCount === 0 ? (
              <Card className="gap-sm">
                <Text variant="headingSmall">{t('cards.empty')}</Text>
                <Text tone="secondary">{t('cards.emptyHint')}</Text>
              </Card>
            ) : (
              <Text tone="secondary">{t('details.browseHint')}</Text>
            )}
            <Button
              label={t('details.viewCards')}
              variant="secondary"
              onPress={() => router.push({ pathname: '/decks/[deckId]/cards', params: { deckId } })}
            />
          </View>
          <View className="gap-sm">
            <Button
              label={t('study.start')}
              loading={study.starting}
              onPress={() => void study.start({ kind: 'specific-deck', deckId })}
            />
            {study.error ? (
              <Card className="gap-sm" accessibilityLiveRegion="polite">
                <Text tone="error">
                  {language === 'en' ? study.error : t('common.genericError')}
                </Text>
                {study.activeSession ? (
                  <Button
                    label={t('study.resume')}
                    variant="secondary"
                    onPress={() => study.activeSession && openStudySession(study.activeSession)}
                  />
                ) : null}
              </Card>
            ) : null}
            <Button
              label={t('cards.add')}
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/decks/[deckId]/cards/create', params: { deckId } })
              }
            />
            <Button
              label={t('details.editDeck')}
              variant="secondary"
              onPress={() => router.push({ pathname: '/decks/[deckId]/edit', params: { deckId } })}
            />
          </View>
          <Button
            label={t('details.archiveDeck')}
            variant="tertiary"
            onPress={() => setConfirmArchive(true)}
          />
        </View>
        {confirmArchive ? (
          <ConfirmationPanel
            title={t('details.archiveDeckTitle')}
            description={t('details.archiveDeckHint')}
            cancelLabel={t('details.keepDeck')}
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
