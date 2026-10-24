import { Pressable, View } from 'react-native';
import { FeedbackModal } from '@/shared/ui/feedback-modal';
import { CheckCircle2, Moon, Sun } from 'lucide-react-native';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { useLocalization } from '@/shared/localization/localization-provider';
import { palette } from '@/shared/theme/tokens';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { Card } from '@/shared/ui/card';
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
  const colors = useThemeColors();
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
          <View className="flex-row flex-wrap gap-lg">
            {appearanceChoices.map(({ value }) => {
              const preview = palette[value];
              const selected = value === vm.settings?.theme;
              const Icon = value === 'light' ? Sun : Moon;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={t(`settings.theme.${value}`)}
                  accessibilityHint={t(
                    selected ? 'settings.themeSelected' : 'settings.themeSelect',
                  )}
                  accessibilityState={{
                    selected,
                    busy: !!vm.busy.theme,
                    disabled: !!vm.busy.theme,
                  }}
                  disabled={!!vm.busy.theme}
                  className="flex-1"
                  style={{ minWidth: 130 }}
                  onPress={() => {
                    if (!selected) void vm.setTheme(value);
                  }}
                >
                  <Card
                    style={{
                      padding: 14,
                      borderColor: selected ? colors.primary : colors.border,
                      borderWidth: 2,
                      opacity: vm.busy.theme ? 0.6 : 1,
                    }}
                    className="gap-md"
                  >
                    <View
                      importantForAccessibility="no-hide-descendants"
                      style={{
                        backgroundColor: preview.background,
                        borderRadius: 16,
                        padding: 14,
                        gap: 12,
                      }}
                    >
                      <Icon color={preview.primary} size={26} />
                      <View
                        style={{
                          height: 6,
                          width: '65%',
                          borderRadius: 4,
                          backgroundColor: preview.secondaryText,
                          opacity: 0.5,
                        }}
                      />
                      <View
                        style={{
                          backgroundColor: preview.surface,
                          borderRadius: 12,
                          padding: 10,
                          gap: 10,
                        }}
                      >
                        <View
                          style={{
                            height: 6,
                            width: '80%',
                            borderRadius: 4,
                            backgroundColor: preview.primarySoft,
                          }}
                        />
                        <View
                          style={{ height: 19, borderRadius: 6, backgroundColor: preview.primary }}
                        />
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between gap-sm">
                      <Text variant="labelLarge">{t(`settings.theme.${value}`)}</Text>
                      {selected ? <CheckCircle2 color={colors.primary} size={20} /> : null}
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {vm.errors.theme ? (
          <FeedbackModal message={language === 'en' ? vm.errors.theme : t('common.genericError')} />
        ) : null}
        <Text variant="bodySmall" tone="secondary">
          {t('settings.themeLifetime')}
        </Text>
      </View>
    </Screen>
  );
}
