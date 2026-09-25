import { View } from 'react-native';

import { languageTag } from '@/core/domain/values';
import { useLocalization } from '@/shared/localization/localization-provider';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useSettingsViewModel } from './use-settings-view-model';

const languages = ['en', 'fa', 'ar'] as const;

export function LanguageScreen() {
  const vm = useSettingsViewModel();
  const { t, language } = useLocalization();
  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-xl">
        <ScreenHeader title={t('settings.appLanguage')} description={t('settings.languageHint')} />
        {vm.loading && !vm.settings ? <LoadingState label={t('settings.loading')} /> : null}
        {vm.loadError && !vm.settings ? (
          <View className="gap-md">
            <EmptyState title={t('settings.loadError')} description={t('common.genericError')} />
            <Button label={t('common.tryAgain')} onPress={vm.reload} />
          </View>
        ) : null}
        {vm.settings ? (
          <View className="gap-sm">
            {languages.map((tag) => (
              <Button
                key={tag}
                label={t(`language.${tag}`)}
                variant={vm.settings?.language === tag ? 'primary' : 'secondary'}
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
