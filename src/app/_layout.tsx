import '@/shared/theme/global.css';

import { useEffect } from 'react';
import { LocaleProvider, Stack, router, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { logger } from '@/core/infrastructure/platform';
import { application } from '@/core/composition/application';
import { expoNotificationService } from '@/core/infrastructure/expo-notification-service';
import { createReminderTapHandler } from '@/features/study/application/create-reminder-tap-handler';
import { BootstrapGate } from '@/shared/bootstrap/bootstrap-gate';
import { LocalizationProvider, useLocalization } from '@/shared/localization/localization-provider';
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
        <LocalizationProvider>
          <LocalizedError retry={retry} />
        </LocalizationProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function LocalizedError({ retry }: { retry: ErrorBoundaryProps['retry'] }) {
  const { t } = useLocalization();
  return (
    <Screen>
      <View className="flex-1 justify-center gap-lg">
        <EmptyState title={t('common.errorTitle')} description={t('common.errorHint')} />
        <Button label={t('common.tryAgain')} onPress={() => void retry()} />
      </View>
    </Screen>
  );
}

function Navigation() {
  const mode = useThemeMode();
  const colors = useThemeColors();
  const { t, direction } = useLocalization();
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
    <LocaleProvider direction={direction}>
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
          options={{ title: t('nav.createDeck'), presentation: 'modal' }}
        />
        <Stack.Screen name="decks/[deckId]/index" options={{ title: t('nav.deckDetails') }} />
        <Stack.Screen name="decks/[deckId]/edit" options={{ title: t('nav.editDeck') }} />
        <Stack.Screen name="decks/[deckId]/cards/index" options={{ title: t('nav.cards') }} />
        <Stack.Screen
          name="decks/[deckId]/cards/create"
          options={{ title: t('nav.createCard'), presentation: 'modal' }}
        />
        <Stack.Screen
          name="decks/[deckId]/cards/[cardId]/index"
          options={{ title: t('nav.cardDetails') }}
        />
        <Stack.Screen
          name="decks/[deckId]/cards/[cardId]/edit"
          options={{ title: t('nav.editCard') }}
        />
        <Stack.Screen
          name="study/[sessionId]"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="vocabulary/helper"
          options={{ title: t('nav.vocabulary'), presentation: 'modal' }}
        />
        <Stack.Screen name="settings/appearance" options={{ title: t('nav.appearance') }} />
        <Stack.Screen name="settings/language" options={{ title: t('settings.appLanguage') }} />
        <Stack.Screen name="settings/speech" options={{ title: t('nav.pronunciation') }} />
        <Stack.Screen name="+not-found" options={{ title: t('common.notFound') }} />
        <Stack.Screen name="design-system" options={{ title: t('nav.designSystem') }} />
      </Stack>
    </LocaleProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LocalizationProvider>
            <BootstrapGate>
              <Navigation />
            </BootstrapGate>
          </LocalizationProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
