import { View } from 'react-native';
import { languageTag } from '@/core/domain/values';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useSettingsViewModel } from './use-settings-view-model';

const languages = [
  { label: 'English', tag: 'en' },
  { label: 'Persian', tag: 'fa' },
  { label: 'Arabic', tag: 'ar' },
] as const;
const accents = [
  { label: 'Device default', value: null },
  { label: 'US English', value: 'us' },
  { label: 'UK English', value: 'uk' },
] as const;

export function SpeechSettingsScreen() {
  const vm = useSettingsViewModel();
  const language = vm.settings?.preferredSpeechLanguage
    .toLowerCase()
    .replaceAll('_', '-')
    .split('-')[0];
  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-xl">
        <ScreenHeader
          title="Pronunciation"
          description="Choose your fallback voice language. Each deck's language takes priority."
        />
        {vm.loading && !vm.settings ? <LoadingState label="Loading speech settings" /> : null}
        {vm.loadError && !vm.settings ? <Button label="Try again" onPress={vm.reload} /> : null}
        {vm.settings ? (
          <>
            <View className="gap-sm">
              <Text variant="headingSmall" accessibilityRole="header">
                Speech language
              </Text>
              {languages.map(({ tag, label }) => (
                <Button
                  key={tag}
                  label={label}
                  variant={language === tag ? 'primary' : 'secondary'}
                  accessibilityHint={
                    language === tag ? 'Selected language' : 'Select speech language'
                  }
                  accessibilityState={{ selected: language === tag, busy: !!vm.busy.speech }}
                  disabled={!!vm.busy.speech}
                  onPress={() => {
                    if (language !== tag) void vm.setSpeechLanguage(languageTag(tag));
                  }}
                />
              ))}
              <Text variant="bodySmall" tone="secondary">
                Available voices depend on your device.
              </Text>
            </View>
            {language === 'en' ? (
              <View className="gap-sm">
                <Text variant="headingSmall" accessibilityRole="header">
                  English accent
                </Text>
                {accents.map(({ label, value }) => (
                  <Button
                    key={label}
                    label={label}
                    variant={vm.settings?.preferredSpeechAccent === value ? 'primary' : 'secondary'}
                    accessibilityHint={
                      vm.settings?.preferredSpeechAccent === value
                        ? 'Selected accent'
                        : 'Select accent'
                    }
                    accessibilityState={{
                      selected: vm.settings?.preferredSpeechAccent === value,
                      busy: !!vm.busy.speech,
                    }}
                    disabled={!!vm.busy.speech}
                    onPress={() => {
                      if (vm.settings?.preferredSpeechAccent !== value)
                        void vm.setSpeechAccent(value);
                    }}
                  />
                ))}
                <Text variant="bodySmall" tone="secondary">
                  The device may use another English accent if your preference is unavailable.
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
        {vm.errors.speech ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {vm.errors.speech}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
