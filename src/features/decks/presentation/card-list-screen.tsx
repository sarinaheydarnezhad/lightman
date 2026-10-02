import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, ScrollView, View } from 'react-native';
import { BookOpen, Search } from 'lucide-react-native';

import type { Card } from '@/features/study/domain/card';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/chip';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { Input } from '@/shared/ui/input';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { CardListItem } from './card-list-item';
import { useCardListViewModel } from './use-cards-view-model';

export function CardListScreen({ deckId }: { deckId: string }) {
  const { t, number, language } = useLocalization();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const { data, cards, categories, totalCount, loading, error, refresh } = useCardListViewModel(
    deckId,
    search,
    category,
  );
  const openCard = useCallback(
    (cardId: string) =>
      router.push({
        pathname: '/decks/[deckId]/cards/[cardId]',
        params: { deckId, cardId },
      }),
    [deckId],
  );
  const renderItem = useCallback(
    ({ item }: { item: Card }) =>
      data ? <CardListItem card={item} deck={data.deck} onPress={openCard} /> : null,
    [data, openCard],
  );

  return (
    <Screen edges={stackScreenEdges}>
      <FlatList
        data={loading || error ? [] : cards}
        keyExtractor={(card) => card.id}
        renderItem={renderItem}
        contentContainerClassName="pb-3xl"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        ListHeaderComponent={
          <View className="gap-lg pb-md">
            <ScreenHeader
              title={data?.deck.name ?? t('nav.cards')}
              description={t('cards.description')}
            />
            <Button
              label={t('cards.viewDeck')}
              variant="tertiary"
              onPress={() =>
                router.dismissTo({
                  pathname: '/decks/[deckId]',
                  params: { deckId },
                })
              }
            />
            {totalCount > 0 && !error ? (
              <Button
                label={t('cards.add')}
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/decks/[deckId]/cards/create',
                    params: { deckId },
                  })
                }
              />
            ) : null}
            <Input
              label={t('cards.search')}
              placeholder={t('cards.searchHint')}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {categories.length > 0 && !error ? (
              <View className="gap-sm">
                <Text variant="labelMedium">{t('cards.category')}</Text>
                <ScrollView
                  horizontal
                  contentContainerClassName="gap-sm"
                  showsHorizontalScrollIndicator={false}
                >
                  {[null, ...categories].map((value) => (
                    <Chip
                      key={value ?? 'all-categories'}
                      label={value ?? t('cards.allCategories')}
                      selected={category === value}
                      accessibilityState={{ selected: category === value }}
                      onPress={() => setCategory(value)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}
            {!loading && !error ? (
              <Text variant="labelMedium" tone="secondary">
                {t('cards.count', { visible: number(cards.length), total: number(totalCount) })}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState label={t('cards.loading')} />
          ) : error ? (
            <View className="gap-md">
              <ErrorState
                title={t('cards.error')}
                description={language === 'en' ? error : t('common.genericError')}
                onRetry={refresh}
              />
              <Button
                label={t('common.browseDecks')}
                variant="secondary"
                onPress={() => router.replace('/decks')}
              />
            </View>
          ) : (
            <View className="gap-md">
              <EmptyState
                title={t(totalCount === 0 ? 'cards.empty' : 'cards.noMatch')}
                description={t(totalCount === 0 ? 'cards.emptyHint' : 'cards.noMatchHint')}
                icon={totalCount === 0 ? BookOpen : Search}
              />
              {totalCount > 0 ? (
                <Button
                  label={t('cards.clear')}
                  variant="secondary"
                  onPress={() => {
                    setSearch('');
                    setCategory(null);
                  }}
                />
              ) : null}
              {totalCount === 0 ? (
                <Button
                  label={t('cards.add')}
                  onPress={() =>
                    router.push({
                      pathname: '/decks/[deckId]/cards/create',
                      params: { deckId },
                    })
                  }
                />
              ) : null}
            </View>
          )
        }
      />
    </Screen>
  );
}
