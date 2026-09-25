import { router } from 'expo-router';
import { View } from 'react-native';

import { layout } from '@/shared/theme/tokens';
import { useLocalization } from '@/shared/localization/localization-provider';
import { deckLanguageLabel } from '@/shared/localization/localization';
import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useHomeViewModel } from './use-home-view-model';
import { useStartStudy, openStudySession } from '@/features/study/presentation/use-start-study';

export function HomeScreen() {
  const { t, number, language } = useLocalization();
  const home = useHomeViewModel();
  const study = useStartStudy();
  const metrics = [
    { label: t('home.cards'), value: home.cardCount },
    { label: t('home.reviews'), value: home.reviewCount },
  ];

  return (
    <Screen scroll edges={tabScreenEdges}>
      <View className="gap-2xl">
        <View className="gap-lg">
          <ScreenHeader title={t('home.welcome')} description={t('home.greeting')} />
          <Badge label={t('home.overview')} />
        </View>

        <View className="gap-md">
          <Text variant="headingMedium" accessibilityRole="header">
            {t('home.collection')}
          </Text>
          {home.loading ? <LoadingState label={t('home.loading')} /> : null}
          {home.error ? (
            <ErrorState
              title={t('home.loadError')}
              description={language === 'en' ? home.error : t('common.genericError')}
              onRetry={home.refresh}
            />
          ) : null}
          {!home.loading && !home.error ? (
            <View className="flex-row flex-wrap gap-sm">
              {metrics.map((metric) => (
                <Card
                  key={metric.label}
                  className="flex-1 gap-sm"
                  style={{ minWidth: layout.metricMinWidth }}
                >
                  <Text tone="secondary" variant="bodySmall">
                    {metric.label}
                  </Text>
                  <Text variant="headingMedium">{number(metric.value)}</Text>
                </Card>
              ))}
            </View>
          ) : null}
          <Button
            label={t('study.start')}
            loading={study.starting}
            onPress={() => void study.start({ kind: 'all-decks' })}
          />
          {study.error ? (
            <Card className="gap-sm" accessibilityLiveRegion="polite">
              <Text tone="error">{language === 'en' ? study.error : t('common.genericError')}</Text>
              {study.activeSession ? (
                <Button
                  label={t('study.resume')}
                  variant="secondary"
                  onPress={() => study.activeSession && openStudySession(study.activeSession)}
                />
              ) : null}
            </Card>
          ) : null}
        </View>

        <View className="gap-md">
          <Text variant="headingMedium" accessibilityRole="header">
            {t('home.yourDecks')}
          </Text>
          {!home.loading && !home.error
            ? home.featuredDecks.map((deck) => (
                <Card
                  key={deck.id}
                  variant="interactive"
                  accessibilityLabel={t('home.openDeck', { name: deck.name })}
                  onPress={() =>
                    router.push({ pathname: '/decks/[deckId]', params: { deckId: deck.id } })
                  }
                  className="gap-sm"
                >
                  <Text variant="headingSmall" numberOfLines={2}>
                    {deck.name}
                  </Text>
                  {deck.description ? (
                    <Text tone="secondary" numberOfLines={2}>
                      {deck.description}
                    </Text>
                  ) : null}
                  <Text tone="tertiary" variant="caption">
                    {deckLanguageLabel(deck.language, language)}
                  </Text>
                </Card>
              ))
            : null}
          {!home.loading && !home.error && home.featuredDecks.length === 0 ? (
            <Text tone="secondary">{t('home.empty')}</Text>
          ) : null}
          <Button
            label={t('home.browse')}
            variant="tertiary"
            onPress={() => router.push('/decks')}
          />
        </View>
      </View>
    </Screen>
  );
}
