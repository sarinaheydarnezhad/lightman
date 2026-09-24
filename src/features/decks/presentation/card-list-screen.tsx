import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, View } from 'react-native';

import type { Card } from '@/features/study/domain/card';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { Input } from '@/shared/ui/input';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { CardListItem } from './card-list-item';
import { useCardListViewModel } from './use-cards-view-model';

export function CardListScreen({ deckId }: { deckId: string }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const { data, cards, categories, totalCount, loading, error, refresh } = useCardListViewModel(
    deckId,
    search,
    category,
  );
  const renderItem = useCallback(
    ({ item }: { item: Card }) =>
      data ? (
        <CardListItem
          card={item}
          deck={data.deck}
          onPress={() =>
            router.push({
              pathname: '/decks/[deckId]/cards/[cardId]',
              params: { deckId, cardId: item.id },
            })
          }
        />
      ) : null,
    [data, deckId],
  );

  return (
    <Screen edges={stackScreenEdges}>
      <FlatList
        data={loading || error ? [] : cards}
        keyExtractor={(card) => card.id}
        renderItem={renderItem}
        contentContainerClassName="gap-md pb-3xl"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View className="gap-lg pb-md">
            <ScreenHeader title={data?.deck.name ?? 'Cards'} description="Cards in this deck" />
            <Button
              label="View deck"
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
                label="Add card"
                onPress={() =>
                  router.push({
                    pathname: '/decks/[deckId]/cards/create',
                    params: { deckId },
                  })
                }
              />
            ) : null}
            <Input
              label="Search cards"
              placeholder="Search term, phonetic, category, meaning"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {categories.length > 0 && !error ? (
              <View className="gap-sm">
                <Text variant="labelMedium">Category</Text>
                <FlatList
                  horizontal
                  data={[
                    { label: 'All categories', value: null },
                    ...categories.map((value) => ({ label: value, value })),
                  ]}
                  keyExtractor={(item) => item.value ?? 'all-categories'}
                  renderItem={({ item }) => (
                    <View className="mr-sm">
                      <Button
                        label={item.label}
                        variant={category === item.value ? 'primary' : 'secondary'}
                        accessibilityState={{ selected: category === item.value }}
                        onPress={() => setCategory(item.value)}
                      />
                    </View>
                  )}
                  showsHorizontalScrollIndicator={false}
                />
              </View>
            ) : null}
            {!loading && !error ? (
              <Text variant="labelMedium" tone="secondary">
                {cards.length} of {totalCount} cards
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState label="Loading cards" />
          ) : error ? (
            <View className="gap-md">
              <EmptyState title="Cards unavailable" description={error} />
              <Button label="Try again" onPress={refresh} />
              <Button
                label="Browse decks"
                variant="tertiary"
                onPress={() => router.replace('/decks')}
              />
            </View>
          ) : (
            <View className="gap-md">
              <EmptyState
                title={totalCount === 0 ? 'No cards yet' : 'No matching cards'}
                description={
                  totalCount === 0
                    ? 'Add a card to start building this deck.'
                    : 'Try a different search or category.'
                }
              />
              {totalCount > 0 ? (
                <Button
                  label="Clear filters"
                  variant="secondary"
                  onPress={() => {
                    setSearch('');
                    setCategory(null);
                  }}
                />
              ) : null}
              {totalCount === 0 ? (
                <Button
                  label="Add card"
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
