import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, View } from 'react-native';

import type { Deck } from '@/features/decks/domain/deck';
import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { Input } from '@/shared/ui/input';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { DeckListItem } from './deck-list-item';
import { useDecksViewModel } from './use-decks-view-model';

type ListedDeck = Deck & { cardCount: number };

export function DecksScreen() {
  const [search, setSearch] = useState('');
  const { decks, totalCount, error, loading, refresh } = useDecksViewModel(search);
  const renderItem = useCallback(
    ({ item }: { item: ListedDeck }) => (
      <DeckListItem
        deck={item}
        cardCount={item.cardCount}
        onPress={() => router.push({ pathname: '/decks/[deckId]', params: { deckId: item.id } })}
      />
    ),
    [],
  );

  return (
    <Screen edges={tabScreenEdges}>
      <FlatList
        data={loading || error ? [] : decks}
        keyExtractor={(deck) => deck.id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerClassName="gap-md pb-3xl"
        ListHeaderComponent={
          <View className="gap-lg pb-md">
            <ScreenHeader title="Decks" description="Your collections, ready when you are." />
            {totalCount > 0 ? (
              <Button label="Create deck" onPress={() => router.push('/decks/create')} />
            ) : null}
            <Input
              label="Search decks"
              placeholder="Search by name"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {!loading && !error && totalCount > 0 ? (
              <Text tone="secondary" variant="labelMedium">
                {decks.length} of {totalCount} decks
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState label="Loading decks" />
          ) : error ? (
            <View className="gap-md">
              <EmptyState title="Unable to load decks" description={error} />
              <Button label="Try again" onPress={refresh} />
            </View>
          ) : (
            <View className="gap-md">
              <EmptyState
                title={search.trim() ? 'No matching decks' : 'No decks yet'}
                description={
                  search.trim()
                    ? 'Try another name, or clear your search.'
                    : 'Create a deck to start collecting what you want to learn.'
                }
              />
              {totalCount === 0 ? (
                <Button label="Create deck" onPress={() => router.push('/decks/create')} />
              ) : null}
            </View>
          )
        }
      />
    </Screen>
  );
}
