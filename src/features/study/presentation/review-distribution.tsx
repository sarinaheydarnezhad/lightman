import { Pressable, View } from 'react-native';
import type { SchedulerDistributionGroup } from '../domain/review-engine';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';

export function ReviewDistribution({
  distributions,
  onSelectSection,
}: {
  distributions: readonly SchedulerDistributionGroup[];
  onSelectSection?: (key: string) => void;
}) {
  const { t, number, language, direction } = useLocalization();
  const SectionRow = onSelectSection ? Pressable : View;
  return (
    <Card className="gap-md">
      <Text variant="headingSmall" accessibilityRole="header">
        {t('review.distribution')}
      </Text>
      <Text tone="secondary" variant="bodySmall">
        {t('review.distributionHint')}
      </Text>
      {distributions.map((distribution) => (
        <View key={distribution.schedulerId} className="gap-sm">
          <Text variant="labelLarge">
            {distribution.localizedLabels?.[language] ?? distribution.label}
          </Text>
          {distribution.sections.map((section) => (
            <SectionRow
              key={section.key}
              className={`justify-between gap-md ${onSelectSection ? 'min-h-11 items-center rounded-md border border-border px-sm' : ''} ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}
              accessible
              accessibilityRole={onSelectSection ? 'button' : undefined}
              {...(onSelectSection ? { onPress: () => onSelectSection(section.key) } : {})}
              accessibilityLabel={t('review.sectionA11y', {
                label: section.localizedLabels?.[language] ?? section.label,
                count: number(section.count),
                unit: t(section.count === 1 ? 'analytics.cardUnit' : 'analytics.cardsUnit'),
              })}
            >
              <Text className="min-w-0 flex-1">
                {section.localizedLabels?.[language] ?? section.label}
              </Text>
              <Text variant="labelLarge">{number(section.count)}</Text>
            </SectionRow>
          ))}
        </View>
      ))}
      {!distributions.some((group) => group.sections.some((section) => section.count > 0)) ? (
        <Text tone="secondary">{t('analytics.boxEmpty')}</Text>
      ) : null}
    </Card>
  );
}
