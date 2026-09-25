import { View } from 'react-native';
import { languageTag } from '@/core/domain/values';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useSettingsViewModel } from './use-settings-view-model';

const languages = ['en', 'fa', 'ar'] as const;
const accents = [null, 'us', 'uk'] as const;

export function SpeechSettingsScreen() {
  const vm = useSettingsViewModel();
  const { t, language: uiLanguage } = useLocalization();
  const language = vm.settings?.preferredSpeechLanguage
    .toLowerCase()
    .replaceAll('_', '-')
    .split('-')[0];
  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="gap-xl">
        <ScreenHeader title={t('settings.pronunciation')} description={t('settings.speechHint')} />
        {vm.loading && !vm.settings ? <LoadingState label={t('settings.loading')} /> : null}
        {vm.loadError && !vm.settings ? (
          <View className="gap-md">
            <EmptyState title={t('settings.loadError')} description={t('common.genericError')} />
            <Button label={t('common.tryAgain')} onPress={vm.reload} />
          </View>
        ) : null}
        {vm.settings ? (
          <>
            <View className="gap-sm">
              <Text variant="headingSmall" accessibilityRole="header">
                {t('settings.speechLanguage')}
              </Text>
              {languages.map((tag) => (
                <Button
                  key={tag}
                  label={t(`language.${tag}`)}
                  variant={language === tag ? 'primary' : 'secondary'}
                  accessibilityHint={t(
                    language === tag ? 'settings.speechSelected' : 'settings.speechSelect',
                  )}
                  accessibilityState={{ selected: language === tag, busy: !!vm.busy.speech }}
                  disabled={!!vm.busy.speech}
                  onPress={() => {
                    if (language !== tag) void vm.setSpeechLanguage(languageTag(tag));
                  }}
                />
              ))}
              <Text variant="bodySmall" tone="secondary">
                {t('settings.voices')}
              </Text>
            </View>
            {language === 'en' ? (
              <View className="gap-sm">
                <Text variant="headingSmall" accessibilityRole="header">
                  {t('settings.englishAccent')}
                </Text>
                {accents.map((value) => (
                  <Button
                    key={value ?? 'default'}
                    label={t(
                      value === null
                        ? 'settings.deviceDefault'
                        : value === 'us'
                          ? 'settings.usEnglish'
                          : 'settings.ukEnglish',
                    )}
                    variant={vm.settings?.preferredSpeechAccent === value ? 'primary' : 'secondary'}
                    accessibilityHint={
                      vm.settings?.preferredSpeechAccent === value
                        ? t('settings.accentSelected')
                        : t('settings.accentSelect')
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
                  {t('settings.accentHint')}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
        {vm.errors.speech ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {uiLanguage === 'en' ? vm.errors.speech : t('common.genericError')}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
