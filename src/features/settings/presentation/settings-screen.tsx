import { View } from 'react-native';
import { Link } from 'expo-router';

import { useUiStore, type ThemePreference } from '@/store/ui-store';
import { Button } from '@/shared/ui/button';
import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';

const preferences: ThemePreference[] = ['system', 'light', 'dark', 'oled'];

export function SettingsScreen() {
  const preference = useUiStore((state) => state.themePreference);
  const setPreference = useUiStore((state) => state.setThemePreference);
  return (
    <Screen>
      <Text variant="headingLarge">Settings</Text>
      <Text tone="secondary" className="mt-md">
        Choose how the app looks on this device.
      </Text>
      <View className="mt-2xl gap-md">
        {preferences.map((option) => (
          <Button
            key={option}
            label={`${option[0]?.toUpperCase() ?? ''}${option.slice(1)}`}
            variant={option === preference ? 'primary' : 'secondary'}
            accessibilityState={{ selected: option === preference }}
            onPress={() => setPreference(option)}
          />
        ))}
      </View>
      <Text tone="secondary" variant="bodySmall" className="mt-xl">
        Appearance resets when the app restarts during this foundation phase.
      </Text>
      {__DEV__ ? <Link href="/design-system" className="mt-xl text-labelLarge text-primary">View design system</Link> : null}
    </Screen>
  );
}
