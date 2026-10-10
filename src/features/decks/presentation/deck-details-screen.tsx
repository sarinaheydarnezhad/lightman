import { useEffect, useRef, useState } from 'react';
import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { haptics } from '@/core/composition/haptics';
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
import { deckContentStyle, deckTypography } from './deck-presentation';
import { useDeckActions, useDeckDetailsViewModel } from './use-decks-view-model';
import { useStartStudy, openStudySession } from '@/features/study/presentation/use-start-study';
import { ReviewDistribution } from '@/features/study/presentation/review-distribution';

export function DeckDetailsScreen({ deckId }: { deckId: string }) {
  const { t, number, language } = useLocalization();
  const { data, loading, error, refresh } = useDeckDetailsViewModel(deckId);
  const actions = useDeckActions();
  const study = useStartStudy();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const deck = data?.deck;

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
      await actions.remove(deckId);
      if (!mounted.current) return;
      void haptics.actionConfirmed();
      router.replace('/decks');
    } catch {
      if (mounted.current) {
        setActionError(t('details.deckDeleteError'));
      }
      void haptics.actionRejected();
      submitting.current = false;
      if (mounted.current) setDeleting(false);
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
        onRetry={refresh}
      >
        <Button
          label={t('common.browseDecks')}
          variant="secondary"
          onPress={() => router.replace('/decks')}
        />
      </FeaturePlaceholder>
    );
  }

  const contentStyle = deckContentStyle(deck.description, deck.textAlignment);

  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-2xl pb-3xl">
        <View
          className="gap-2xl"
          pointerEvents={confirmDelete ? 'none' : 'auto'}
          accessibilityElementsHidden={confirmDelete}
          importantForAccessibility={confirmDelete ? 'no-hide-descendants' : 'auto'}
        >
          <ScreenHeader title={deck.name} description={deck.description} />
          <Button
            label={t('transfer.export')}
            variant="secondary"
            onPress={() =>
              router.push(`/settings/transfer?deckId=${encodeURIComponent(deckId)}` as Href)
            }
          />
          <Button
            label={t('study.start')}
            loading={study.starting}
            onPress={() => void study.start({ kind: 'specific-deck', deckId })}
          />
          <View className="gap-sm border-b border-border pb-xl">
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
          </View>
          <ReviewDistribution distributions={[data.distribution]} />
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
              <View className="gap-sm">
                <Text variant="headingSmall">{t('cards.empty')}</Text>
                <Text tone="secondary">{t('cards.emptyHint')}</Text>
              </View>
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
            {study.error ? (
              <View className="gap-sm" accessibilityLiveRegion="polite">
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
              </View>
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
            label={t('details.deleteDeck')}
            variant="destructive"
            onPress={() => setConfirmDelete(true)}
          />
        </View>
        {confirmDelete ? (
          <ConfirmationPanel
            title={t('details.deleteDeckTitle')}
            description={t('details.deleteDeckHint')}
            cancelLabel={t('details.keepDeck')}
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
