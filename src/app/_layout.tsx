import '@/shared/theme/global.css';

import { useEffect } from 'react';
import { Stack, router, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { logger } from '@/core/infrastructure/platform';
import { application } from '@/core/composition/application';
import { expoNotificationService } from '@/core/infrastructure/expo-notification-service';
import { createReminderTapHandler } from '@/features/study/application/create-reminder-tap-handler';
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
  useEffect(() => {
    const handleTap = createReminderTapHandler(
      application,
      (session) =>
        router.push({
          pathname: '/study/[sessionId]',
          params: { sessionId: session.id },
        }),
      () => router.push('/study'),
    );
    const unsubscribe = expoNotificationService.subscribeToReminderTaps(() => {
      void handleTap();
    });
    try {
      if (expoNotificationService.consumeLastReminderTap()) void handleTap();
    } catch (error) {
      logger.error('Unable to read reminder tap', error);
    }
    return unsubscribe;
  }, []);
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
        <Stack.Screen name="decks/[deckId]/cards/index" options={{ title: 'Cards' }} />
        <Stack.Screen
          name="decks/[deckId]/cards/create"
          options={{ title: 'Create card', presentation: 'modal' }}
        />
        <Stack.Screen
          name="decks/[deckId]/cards/[cardId]/index"
          options={{ title: 'Card details' }}
        />
        <Stack.Screen name="decks/[deckId]/cards/[cardId]/edit" options={{ title: 'Edit card' }} />
        <Stack.Screen
          name="study/[sessionId]"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="vocabulary/helper"
          options={{ title: 'Vocabulary helper', presentation: 'modal' }}
        />
        <Stack.Screen name="settings/appearance" options={{ title: 'Appearance' }} />
        <Stack.Screen name="settings/speech" options={{ title: 'Pronunciation' }} />
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
