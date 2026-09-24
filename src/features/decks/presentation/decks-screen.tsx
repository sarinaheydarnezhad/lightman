import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { ListFilter } from 'lucide-react-native';

import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { IconButton } from '@/shared/ui/icon-button';
import { Input } from '@/shared/ui/input';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useDecksViewModel } from './use-decks-view-model';

export function DecksScreen() {
  const [search, setSearch] = useState('');
  const { decks, totalCount, error, loading, refresh } = useDecksViewModel(search);

  return (
    <Screen scroll edges={tabScreenEdges}>
      <View className="gap-xl">
        <ScreenHeader title="Decks" description="Find a deck and pick up where you left off." />
        <Input
          label="Search decks"
          placeholder="Search by name"
          value={search}
          onChangeText={setSearch}
        />
        <View className="flex-row items-center justify-between gap-sm">
          <Text tone="secondary" variant="labelMedium">
            {decks.length} of {totalCount} decks
          </Text>
          <IconButton icon={ListFilter} label="Sort and filter decks (coming later)" disabled />
        </View>

        {loading && !decks.length ? <LoadingState label="Loading decks" /> : null}
        {error ? <EmptyState title="Unable to load decks" description={error} /> : null}
        {error ? <Button label="Try again" onPress={refresh} /> : null}
        {!loading && !error && decks.length ? (
          <View className="gap-md">
            {decks.map((deck) => (
              <Card
                key={deck.id}
                variant="interactive"
                accessibilityLabel={`Open ${deck.title} deck`}
                onPress={() =>
                  router.push({ pathname: '/decks/[deckId]', params: { deckId: deck.id } })
                }
                className="gap-sm"
              >
                <Text variant="headingSmall">{deck.title}</Text>
                <Text tone="secondary">{deck.description}</Text>
                <Badge label={`${deck.cardCount} cards`} />
              </Card>
            ))}
          </View>
        ) : !loading && !error ? (
          <EmptyState
            title={search ? 'No matching decks' : 'No decks yet'}
            description={search ? 'Try a different search.' : 'Your decks will appear here.'}
          />
        ) : null}
        <Button label="Create deck" onPress={() => router.push('/decks/create')} />
      </View>
    </Screen>
  );
}
