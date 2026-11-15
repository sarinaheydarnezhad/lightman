import { useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { Settings2 } from 'lucide-react-native';

import { application } from '@/core/composition/application';
import { useLocalization } from '@/shared/localization/localization-provider';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { useThemeColors, useThemeMode } from '@/shared/theme/theme-provider';
import {
  palette,
  type SemanticColor,
  type ThemePreference,
  type TypographyVariant,
} from '@/shared/theme/tokens';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Chip } from '@/shared/ui/chip';
import { Divider } from '@/shared/ui/divider';
import { EmptyState } from '@/shared/ui/empty-state';
import { IconButton } from '@/shared/ui/icon-button';
import { Input } from '@/shared/ui/input';
import { LoadingState } from '@/shared/ui/loading-state';
import { Progress } from '@/shared/ui/progress';
import { Screen } from '@/shared/ui/screen';
import { PageTitle } from '@/shared/ui/screen-header';
import { Tab } from '@/shared/ui/tab';
import { Text } from '@/shared/ui/text';
import { FeedbackNotice } from '@/shared/ui/feedback-notice';
import { ConfirmationPanel } from '@/shared/ui/confirmation-panel';

const preferences: ThemePreference[] = ['light', 'dark'];
const variants: TypographyVariant[] = [
  'display',
  'headingLarge',
  'headingMedium',
  'headingSmall',
  'bodyLarge',
  'bodyMedium',
  'bodySmall',
  'labelLarge',
  'labelMedium',
  'caption',
];
const colorNames = Object.keys(palette.light) as SemanticColor[];

export default function DesignSystemDemo() {
  const { t } = useLocalization();
  const preference =
    useSyncExternalStore(application.settings.subscribe, application.settings.snapshot)?.theme ??
    'light';
  const setPreference = (value: typeof preference) => {
    void application.settings.setTheme(value);
  };
  const mode = useThemeMode();
  const colors = useThemeColors();
  const [selectedTab, setSelectedTab] = useState<'meaning' | 'examples'>('meaning');
  const [selectedChip, setSelectedChip] = useState(false);
  const [pressedCard, setPressedCard] = useState(false);
  const [sample, setSample] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [retrying, setRetrying] = useState(false);

  return (
    <Screen scroll keyboardAware edges={stackScreenEdges} testID="design-system-demo">
      <View className="gap-2xl">
        <View className="gap-sm">
          <PageTitle>{t('nav.designSystem')}</PageTitle>
          <Text tone="secondary">
            {t('showcase.description', { theme: t(`settings.theme.${mode}`) })}
          </Text>
        </View>

        <View className="gap-md">
          <Text variant="headingSmall">{t('settings.appearance')}</Text>
          <View className="flex-row flex-wrap gap-sm">
            {preferences.map((option) => (
              <Chip
                key={option}
                label={t(`settings.theme.${option}`)}
                selected={preference === option}
                onPress={() => setPreference(option)}
              />
            ))}
          </View>
        </View>

        <View className="gap-md">
          <Text variant="headingSmall">{t('showcase.typography')}</Text>
          {variants.map((variant) => (
            <Text key={variant} variant={variant}>
              {variant}
            </Text>
          ))}
          <Text tone="secondary">{t('showcase.inputHint')}</Text>
          <Text tone="tertiary" variant="caption">
            {t('showcase.inputHint')}
          </Text>
        </View>

        <View className="gap-md">
          <Text variant="headingSmall">{t('showcase.colors')}</Text>
          <View className="flex-row flex-wrap gap-sm">
            {colorNames.map((name) => (
              <View key={name} className="w-listItem items-center gap-xs">
                <View
                  className="h-iconButton w-iconButton rounded-sm border border-border"
                  style={{ backgroundColor: colors[name] }}
                />
                <Text variant="caption" align="center">
                  {name}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-md">
          <Text variant="headingSmall">{t('showcase.actions')}</Text>
          <Button label={t('showcase.primary')} />
          <Button label={t('showcase.secondary')} variant="secondary" />
          <Button label={t('showcase.ghost')} variant="ghost" />
          <Button label={t('showcase.destructive')} variant="destructive" />
          <Button label={t('common.loading')} loading />
          <Button label={t('common.unavailable')} disabled />
          <IconButton icon={Settings2} label={t('nav.settings')} />
        </View>

        <View className="gap-md">
          <Text variant="headingSmall">{t('showcase.inputs')}</Text>
          <Input
            label={t('showcase.example')}
            placeholder={t('showcase.placeholder')}
            helperText={t('showcase.inputHint')}
            value={sample}
            onChangeText={setSample}
          />
          <Input label={t('showcase.withError')} error={t('form.termRequired')} />
          <Input
            label={t('showcase.disabledField')}
            disabled
            placeholder={t('common.unavailable')}
          />
          <Input label={t('showcase.example')} multiline placeholder={t('showcase.placeholder')} />
        </View>

        <View className="gap-md">
          <Text variant="headingSmall">{t('showcase.surfaces')}</Text>
          <Card>
            <Text>{t('showcase.defaultSurface')}</Text>
          </Card>
          <Card variant="elevated">
            <Text>{t('showcase.elevatedSurface')}</Text>
          </Card>
          <Card variant="outlined">
            <Text>{t('showcase.outlinedSurface')}</Text>
          </Card>
          <Card
            variant="interactive"
            accessibilityLabel={t('showcase.interactiveSurface')}
            onPress={() => setPressedCard(!pressedCard)}
          >
            <Text>
              {t(pressedCard ? 'showcase.pressedSurface' : 'showcase.interactiveSurface')}
            </Text>
          </Card>
          <Divider />
          <View className="flex-row flex-wrap gap-sm">
            <Badge label="Neutral" />
            <Badge label="Primary" variant="primary" />
            <Badge label="Success" variant="success" />
            <Badge label="Error" variant="error" />
            <Badge label="Warning" variant="warning" />
            <Badge label="Info" variant="info" />
          </View>
          <Chip
            label={t('showcase.select')}
            selected={selectedChip}
            onPress={() => setSelectedChip(!selectedChip)}
          />
        </View>

        <View className="gap-md">
          <Text variant="headingSmall">{t('showcase.states')}</Text>
          <View className="flex-row" accessibilityRole="tablist">
            <Tab
              label={t('study.meaning')}
              active={selectedTab === 'meaning'}
              onPress={() => setSelectedTab('meaning')}
            />
            <Tab
              label={t('study.examples')}
              active={selectedTab === 'examples'}
              onPress={() => setSelectedTab('examples')}
            />
            <Tab label={t('common.unavailable')} disabled />
          </View>
          <View className="gap-sm">
            <Text variant="labelMedium">{t('showcase.example')} · 62%</Text>
            <Progress value={0.62} label={t('showcase.example')} />
          </View>
          <LoadingState label={t('common.loading')} />
          <EmptyState title={t('decks.empty')} description={t('decks.emptyHint')} />
        </View>
        <View className="gap-md">
          <Text variant="headingSmall" accessibilityRole="header">
            {t('showcase.feedback')}
          </Text>
          <FeedbackNotice
            message={t('showcase.error')}
            onRetry={() => setRetrying((value) => !value)}
            busy={retrying}
          />
          {retrying ? (
            <Button
              label={t('common.cancel')}
              variant="secondary"
              onPress={() => setRetrying(false)}
            />
          ) : null}
          <FeedbackNotice message={t('showcase.info')} tone="info" />
          <Button
            label={t('showcase.confirm')}
            variant="secondary"
            onPress={() => setConfirmation(true)}
          />
          {confirmation ? (
            <ConfirmationPanel
              title={t('showcase.confirmTitle')}
              description={t('showcase.info')}
              cancelLabel={t('common.cancel')}
              confirmLabel={t('showcase.continue')}
              destructive={false}
              onCancel={() => setConfirmation(false)}
              onConfirm={() => setConfirmation(false)}
            />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
