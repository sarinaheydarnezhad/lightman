import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Clock3, Layers3 } from 'lucide-react-native';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { useLocalization } from '@/shared/localization/localization-provider';
import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { DeckListItem } from '@/features/decks/presentation/deck-list-item';
import { useHomeViewModel } from './use-home-view-model';
import { StudyEmblem, StudyIllustration } from './study-illustration';
import { useStartStudy, openStudySession } from '@/features/study/presentation/use-start-study';

export function HomeScreen() {
  const { t, number, language, direction } = useLocalization();
  const colors = useThemeColors();
  const { fontScale, width } = useWindowDimensions();
  const spaciousText = fontScale > 1.3 || width < 350;
  const home = useHomeViewModel();
  const study = useStartStudy();
  const BrowseChevron = direction === 'rtl' ? ChevronLeft : ChevronRight;

  function openDeck(deckId: string) {
    router.push({ pathname: '/decks/[deckId]', params: { deckId } });
  }

  return (
    <Screen scroll edges={tabScreenEdges}>
      <View className="gap-xl pb-xl">
        <View
          className="items-center gap-sm"
          style={{
            flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
            minHeight: spaciousText ? undefined : 138,
            marginBottom: spaciousText ? 0 : -24,
          }}
        >
          <View className="min-w-0 flex-1">
            <ScreenHeader title={t('home.welcome')} description={t('home.greeting')} />
          </View>
          {!spaciousText ? (
            <View
              pointerEvents="none"
              importantForAccessibility="no-hide-descendants"
              style={{ width: 142, height: 146, alignSelf: 'flex-end' }}
            >
              <StudyIllustration />
            </View>
          ) : null}
        </View>
        {home.loading ? <LoadingState label={t('home.loading')} /> : null}
        {home.error ? (
          <ErrorState
            title={t('home.loadError')}
            description={language === 'en' ? home.error : t('common.genericError')}
            onRetry={home.refresh}
          />
        ) : null}
        {!home.loading && !home.error ? (
          <>
            <Card className="gap-lg" style={{ padding: 20 }}>
              <View
                className="items-center gap-md"
                style={{ flexDirection: spaciousText ? 'column' : 'row' }}
              >
                <View className="min-w-0 flex-1 gap-xs">
                  <Text variant="bodyLarge" weight="semibold" tone="secondary">
                    {t('home.dueToday')}
                  </Text>
                  <Text
                    variant="display"
                    accessibilityRole="header"
                    style={{ fontSize: 40, lineHeight: 52, textAlign: 'left' }}
                  >
                    {number(home.dueCount)}
                  </Text>
                  <Text tone="secondary">
                    {home.dueCount > 0 ? t('home.readyToReview') : t('study.noneDueHint')}
                  </Text>
                </View>
                <View pointerEvents="none" importantForAccessibility="no-hide-descendants">
                  <StudyEmblem />
                </View>
              </View>
              <Button
                label={
                  home.dueCount > 0
                    ? t('study.start')
                    : home.cardCount > 0
                      ? t('common.browseDecks')
                      : t('decks.create')
                }
                icon={ChevronRight}
                loading={study.starting}
                onPress={() =>
                  home.dueCount > 0
                    ? void study.start({ kind: 'all-decks' })
                    : router.push(home.cardCount > 0 ? '/decks' : '/decks/create')
                }
              />
            </Card>
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
            <Card style={{ padding: 18 }}>
              <View className="gap-lg" style={{ flexDirection: spaciousText ? 'column' : 'row' }}>
                <View className="min-w-0 flex-1 flex-row items-center gap-md">
                  <Layers3 color={colors.primary} size={27} />
                  <View className="min-w-0 flex-1 gap-xs">
                    <Text variant="headingSmall">{number(home.reviewedToday)}</Text>
                    <Text variant="bodySmall" tone="secondary">
                      {t('analytics.cardsToday')}
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    width: spaciousText ? '100%' : 1,
                    height: spaciousText ? 1 : undefined,
                    backgroundColor: colors.border,
                  }}
                />
                <View className="min-w-0 flex-1 flex-row items-center gap-md">
                  <Clock3 color={colors.primary} size={27} />
                  <View className="min-w-0 flex-1 gap-xs">
                    <Text variant="headingSmall">
                      {t(home.streak === 1 ? 'common.day' : 'common.days', {
                        count: number(home.streak),
                      })}
                    </Text>
                    <Text variant="bodySmall" tone="secondary">
                      {t('analytics.currentStreak')}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
            <View className="gap-md">
              <View
                className="items-center justify-between gap-sm"
                style={{
                  flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
                  flexWrap: 'wrap',
                }}
              >
                <Text variant="headingMedium" accessibilityRole="header">
                  {t('home.yourDecks')}
                </Text>
                {home.featuredDecks.length ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('home.browse')}
                    onPress={() => router.push('/decks')}
                    className="min-h-iconButton flex-row items-center gap-xs px-xs"
                  >
                    <BrowseChevron color={colors.primary} size={18} />
                    <Text tone="accent" variant="labelMedium">
                      {t('home.browse')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {home.featuredDecks.length ? (
                home.featuredDecks.map((deck) => (
                  <DeckListItem
                    key={deck.id}
                    deck={deck}
                    showCount={false}
                    accessibilityLabel={t('home.openDeck', { name: deck.name })}
                    onPress={openDeck}
                  />
                ))
              ) : (
                <EmptyState title={t('decks.empty')} description={t('home.empty')} />
              )}
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
