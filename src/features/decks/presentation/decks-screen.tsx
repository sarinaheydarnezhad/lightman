import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, View } from 'react-native';

import type { Deck } from '@/features/decks/domain/deck';
import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { Input } from '@/shared/ui/input';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { DeckListItem } from './deck-list-item';
import { useDecksViewModel } from './use-decks-view-model';

type ListedDeck = Deck & { cardCount: number };

export function DecksScreen() {
  const { t, number, language } = useLocalization();
  const [search, setSearch] = useState('');
  const { decks, totalCount, error, loading, refresh } = useDecksViewModel(search);
  const openDeck = useCallback(
    (deckId: string) => router.push({ pathname: '/decks/[deckId]', params: { deckId } }),
    [],
  );
  const renderItem = useCallback(
    ({ item }: { item: ListedDeck }) => (
      <DeckListItem deck={item} cardCount={item.cardCount} onPress={openDeck} />
    ),
    [openDeck],
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
            <ScreenHeader title={t('nav.decks')} description={t('decks.description')} />
            {totalCount > 0 ? (
              <Button label={t('decks.create')} onPress={() => router.push('/decks/create')} />
            ) : null}
            <Input
              label={t('decks.search')}
              placeholder={t('decks.searchHint')}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {!loading && !error && totalCount > 0 ? (
              <Text tone="secondary" variant="labelMedium">
                {t('decks.count', { visible: number(decks.length), total: number(totalCount) })}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState label={t('decks.loading')} />
          ) : error ? (
            <ErrorState
              title={t('decks.error')}
              description={language === 'en' ? error : t('common.genericError')}
              onRetry={refresh}
            />
          ) : (
            <View className="gap-md">
              <EmptyState
                title={t(search.trim() ? 'decks.noMatch' : 'decks.empty')}
                description={t(search.trim() ? 'decks.noMatchHint' : 'decks.emptyHint')}
              />
              {search.trim() && totalCount > 0 ? (
                <Button
                  label={t('decks.clear')}
                  variant="secondary"
                  onPress={() => setSearch('')}
                />
              ) : null}
              {totalCount === 0 ? (
                <Button label={t('decks.create')} onPress={() => router.push('/decks/create')} />
              ) : null}
            </View>
          )
        }
      />
    </Screen>
  );
}
