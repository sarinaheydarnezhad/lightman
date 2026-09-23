import '@/shared/theme/global.css';

import { useEffect } from 'react';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { logger } from '@/core/infrastructure/platform';
import { useThemeMode, ThemeProvider } from '@/shared/theme/theme-provider';
import { palette } from '@/shared/theme/tokens';
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
          <Text className="mb-3 text-2xl font-semibold">Something went wrong</Text>
          <Text tone="secondary" className="mb-6">
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
  const colors = palette[mode];
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" options={{ headerShown: true, title: 'Not found' }} />
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
