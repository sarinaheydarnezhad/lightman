import { useState } from 'react';
import { View } from 'react-native';

import { application } from '@/core/composition/application';
import { haptics } from '@/core/composition/haptics';
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
  const [error, setError] = useState<string | null>(null);

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
              onPress={() => {
                if (value === preference) return;
                void application
                  .updateSettings({ theme: value })
                  .then(() => {
                    setPreference(value);
                    void haptics.selection();
                    setError(null);
                  })
                  .catch(() => setError('Unable to save appearance. Please try again.'));
              }}
            />
          ))}
        </View>
        {error ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <Text variant="bodySmall" tone="secondary">
          Your choice lasts until you close the app. System follows your device’s light or dark
          mode; OLED uses a true black background.
        </Text>
      </View>
    </Screen>
  );
}
