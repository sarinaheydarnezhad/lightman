import { View } from 'react-native';

import { languageTag, supportedLanguages } from '@/core/domain/values';
import { useLocalization } from '@/shared/localization/localization-provider';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Chip } from '@/shared/ui/chip';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useSettingsViewModel } from './use-settings-view-model';

const languages = supportedLanguages;

export function LanguageScreen() {
  const vm = useSettingsViewModel();
  const { t, language } = useLocalization();
  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-xl">
        <ScreenHeader title={t('settings.appLanguage')} description={t('settings.languageHint')} />
        {vm.loading && !vm.settings ? <LoadingState label={t('settings.loading')} /> : null}
        {vm.loadError && !vm.settings ? (
          <ErrorState
            title={t('settings.loadError')}
            description={t('common.genericError')}
            onRetry={vm.reload}
          />
        ) : null}
        {vm.settings ? (
          <View className="flex-row flex-wrap gap-sm">
            {languages.map((tag) => (
              <Chip
                key={tag}
                label={t(`language.${tag}`)}
                selected={vm.settings?.language === tag}
                accessibilityHint={t(
                  vm.settings?.language === tag
                    ? 'settings.languageSelected'
                    : 'settings.languageSelect',
                )}
                accessibilityState={{
                  selected: vm.settings?.language === tag,
                  busy: !!vm.busy.language,
                }}
                disabled={!!vm.busy.language}
                onPress={() => {
                  if (vm.settings?.language !== tag) void vm.setLanguage(languageTag(tag));
                }}
              />
            ))}
          </View>
        ) : null}
        {vm.errors.language ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {language === 'en' ? vm.errors.language : t('common.genericError')}
          </Text>
        ) : null}
        <Text variant="bodySmall" tone="secondary">
          {t('settings.appLanguageHint')}
        </Text>
      </View>
    </Screen>
  );
}
