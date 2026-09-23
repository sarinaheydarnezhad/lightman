import { View } from 'react-native';

import { useUiStore, type ThemePreference } from '@/store/ui-store';
import { Button } from '@/shared/ui/button';
import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';

const preferences: ThemePreference[] = ['system', 'light', 'dark'];

export function SettingsScreen() {
  const preference = useUiStore((state) => state.themePreference);
  const setPreference = useUiStore((state) => state.setThemePreference);
  return (
    <Screen>
      <Text className="text-3xl font-bold">Settings</Text>
      <Text tone="secondary" className="mt-3">
        Choose how the app looks on this device.
      </Text>
      <View className="mt-8 gap-3">
        {preferences.map((option) => (
          <Button
            key={option}
            label={`${option[0]?.toUpperCase() ?? ''}${option.slice(1)}`}
            variant={option === preference ? 'primary' : 'outline'}
            accessibilityState={{ selected: option === preference }}
            onPress={() => setPreference(option)}
          />
        ))}
      </View>
      <Text tone="secondary" className="mt-6 text-sm">
        Appearance resets when the app restarts during this foundation phase.
      </Text>
    </Screen>
  );
}
