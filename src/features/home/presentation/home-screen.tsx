import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useLocalization } from '@/shared/localization/localization-provider';
import { deckLanguageLabel } from '@/shared/localization/localization';
import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { icons } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useHomeViewModel } from './use-home-view-model';
import { useStartStudy, openStudySession } from '@/features/study/presentation/use-start-study';

export function HomeScreen() {
  const { t, number, language } = useLocalization();
  const colors = useThemeColors();
  const home = useHomeViewModel();
  const study = useStartStudy();

  return (
    <Screen scroll edges={tabScreenEdges}>
      <View className="gap-2xl pb-xl">
        <ScreenHeader title={t('home.welcome')} description={t('home.greeting')} />
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
            <Card className="gap-xl">
              <View className="gap-sm">
                <Text variant="labelMedium" tone="secondary">
                  {t('home.dueToday')}
                </Text>
                <Text variant="display" accessibilityRole="header">
                  {number(home.dueCount)}
                </Text>
                <Text tone="secondary">
                  {home.dueCount > 0 ? t('home.readyToReview') : t('study.noneDueHint')}
                </Text>
              </View>
              <Button
                label={
                  home.dueCount > 0
                    ? t('study.start')
                    : home.cardCount > 0
                      ? t('common.browseDecks')
                      : t('decks.create')
                }
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
            <View className="flex-row gap-xl border-b border-border pb-xl">
              <View className="min-w-0 flex-1 gap-xs">
                <Text variant="headingSmall">{number(home.reviewedToday)}</Text>
                <Text variant="bodySmall" tone="secondary">
                  {t('analytics.cardsToday')}
                </Text>
              </View>
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
            <View className="gap-sm">
              <Text variant="headingMedium" accessibilityRole="header">
                {t('home.yourDecks')}
              </Text>
              {home.featuredDecks.length ? (
                <View>
                  {home.featuredDecks.map((deck) => (
                    <Pressable
                      key={deck.id}
                      accessibilityRole="button"
                      accessibilityLabel={t('home.openDeck', { name: deck.name })}
                      onPress={() =>
                        router.push({ pathname: '/decks/[deckId]', params: { deckId: deck.id } })
                      }
                      className="min-h-listItem flex-row items-center gap-md border-b border-border py-md"
                      style={(state) =>
                        state.pressed ? { backgroundColor: colors.surfaceElevated } : undefined
                      }
                    >
                      <View className="min-w-0 flex-1 gap-xs">
                        <Text variant="labelLarge" numberOfLines={2}>
                          {deck.name}
                        </Text>
                        <Text variant="bodySmall" tone="secondary">
                          {deckLanguageLabel(deck.language, language)}
                        </Text>
                      </View>
                      <ChevronRight color={colors.tertiaryText} size={icons.medium} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <EmptyState title={t('decks.empty')} description={t('home.empty')} />
              )}
              {home.cardCount > 0 ? (
                <Button
                  label={t('home.browse')}
                  variant="ghost"
                  onPress={() => router.push('/decks')}
                />
              ) : null}
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
