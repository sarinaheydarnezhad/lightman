import { View } from 'react-native';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { appearanceChoices } from './appearance-options';
import { useSettingsViewModel } from './use-settings-view-model';

export function AppearanceScreen() {
  const vm = useSettingsViewModel();
  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-xl">
        <ScreenHeader title="Appearance" description="Choose a theme that feels comfortable." />
        {vm.loading && !vm.settings ? <LoadingState label="Loading appearance" /> : null}
        {vm.loadError && !vm.settings ? <Button label="Try again" onPress={vm.reload} /> : null}
        {vm.settings ? (
          <View className="gap-sm">
            {appearanceChoices.map(({ value, label }) => (
              <Button
                key={value}
                label={label}
                variant={value === vm.settings?.theme ? 'primary' : 'secondary'}
                accessibilityHint={value === vm.settings?.theme ? 'Selected theme' : 'Select theme'}
                accessibilityState={{
                  selected: value === vm.settings?.theme,
                  busy: !!vm.busy.theme,
                }}
                disabled={!!vm.busy.theme}
                onPress={() => {
                  if (value !== vm.settings?.theme) void vm.setTheme(value);
                }}
              />
            ))}
          </View>
        ) : null}
        {vm.errors.theme ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {vm.errors.theme}
          </Text>
        ) : null}
        <Text variant="bodySmall" tone="secondary">
          Your choice lasts until you close the app. System follows your device&apos;s light or dark
          mode; OLED uses a true black background.
        </Text>
      </View>
    </Screen>
  );
}
