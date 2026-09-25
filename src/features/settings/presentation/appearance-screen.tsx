import { View } from 'react-native';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { appearanceChoices } from './appearance-options';
import { useSettingsViewModel } from './use-settings-view-model';

export function AppearanceScreen() {
  const vm = useSettingsViewModel();
  const { t, language } = useLocalization();
  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-xl">
        <ScreenHeader title={t('settings.appearance')} description={t('settings.themeHint')} />
        {vm.loading && !vm.settings ? <LoadingState label={t('settings.loading')} /> : null}
        {vm.loadError && !vm.settings ? (
          <ErrorState
            title={t('settings.loadError')}
            description={t('common.genericError')}
            onRetry={vm.reload}
          />
        ) : null}
        {vm.settings ? (
          <View className="gap-sm">
            {appearanceChoices.map(({ value }) => (
              <Button
                key={value}
                label={t(`settings.theme.${value}`)}
                variant={value === vm.settings?.theme ? 'primary' : 'secondary'}
                accessibilityHint={t(
                  value === vm.settings?.theme ? 'settings.themeSelected' : 'settings.themeSelect',
                )}
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
            {language === 'en' ? vm.errors.theme : t('common.genericError')}
          </Text>
        ) : null}
        <Text variant="bodySmall" tone="secondary">
          {t('settings.themeLifetime')}
        </Text>
      </View>
    </Screen>
  );
}
