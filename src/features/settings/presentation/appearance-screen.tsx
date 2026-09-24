import { View } from 'react-native';

import { useUiStore } from '@/store/ui-store';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';

import { appearanceChoices } from './appearance-options';

export function AppearanceScreen() {
  const preference = useUiStore((state) => state.themePreference);
  const setPreference = useUiStore((state) => state.setThemePreference);

  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-xl">
        <ScreenHeader title="Appearance" description="Choose a theme that feels comfortable." />
        <View className="gap-sm">
          {appearanceChoices.map(({ value, label }) => (
            <Button
              key={value}
              label={label}
              variant={value === preference ? 'primary' : 'secondary'}
              accessibilityState={{ selected: value === preference }}
              onPress={() => setPreference(value)}
            />
          ))}
        </View>
        <Text variant="bodySmall" tone="secondary">
          Your choice lasts until you close the app. System follows your device’s light or dark
          mode; OLED uses a true black background.
        </Text>
      </View>
    </Screen>
  );
}
