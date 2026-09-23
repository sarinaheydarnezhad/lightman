import '@/shared/theme/global.css';

import { useEffect } from 'react';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { logger } from '@/core/infrastructure/platform';
import { useThemeColors, useThemeMode, ThemeProvider } from '@/shared/theme/theme-provider';
import { Button } from '@/shared/ui/button';
import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    logger.error('Unhandled route error', error);
  }, [error]);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Screen>
          <Text variant="headingMedium" className="mb-md">Something went wrong</Text>
          <Text tone="secondary" className="mb-xl">
            Please try again to continue.
          </Text>
          <Button label="Try again" onPress={() => void retry()} />
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
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" options={{ headerShown: true, title: 'Not found', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.primaryText }} />
        <Stack.Screen name="design-system" options={{ headerShown: true, title: 'Design system', headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.primaryText }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Navigation />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
