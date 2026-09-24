import '@/shared/theme/global.css';

import { useEffect } from 'react';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { logger } from '@/core/infrastructure/platform';
import { BootstrapGate } from '@/shared/bootstrap/bootstrap-gate';
import { useThemeColors, useThemeMode, ThemeProvider } from '@/shared/theme/theme-provider';
import { EmptyState } from '@/shared/ui/empty-state';
import { Button } from '@/shared/ui/button';
import { Screen } from '@/shared/ui/screen';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    logger.error('Unhandled route error', error);
  }, [error]);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Screen>
          <View className="flex-1 justify-center gap-lg">
            <EmptyState
              title="Something went wrong"
              description="We couldn't show this screen. Please try again."
            />
            <Button label="Try again" onPress={() => void retry()} />
          </View>
        </Screen>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Navigation() {
  const mode = useThemeMode();
  const colors = useThemeColors();
  return (
    <>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primaryText,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="decks/create"
          options={{ title: 'Create deck', presentation: 'modal' }}
        />
        <Stack.Screen name="decks/[deckId]/index" options={{ title: 'Deck details' }} />
        <Stack.Screen name="decks/[deckId]/edit" options={{ title: 'Edit deck' }} />
        <Stack.Screen
          name="decks/[deckId]/cards/create"
          options={{ title: 'Create card', presentation: 'modal' }}
        />
        <Stack.Screen
          name="decks/[deckId]/cards/[cardId]/index"
          options={{ title: 'Card details' }}
        />
        <Stack.Screen name="decks/[deckId]/cards/[cardId]/edit" options={{ title: 'Edit card' }} />
        <Stack.Screen name="study/[sessionId]" options={{ title: 'Study session' }} />
        <Stack.Screen
          name="vocabulary/helper"
          options={{ title: 'Vocabulary helper', presentation: 'modal' }}
        />
        <Stack.Screen name="settings/appearance" options={{ title: 'Appearance' }} />
        <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
        <Stack.Screen name="design-system" options={{ title: 'Design system' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <BootstrapGate>
            <Navigation />
          </BootstrapGate>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
