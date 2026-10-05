import { View } from 'react-native';
import type { SchedulerDistributionGroup } from '../domain/review-engine';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';

export function ReviewDistribution({
  distributions,
}: {
  distributions: readonly SchedulerDistributionGroup[];
}) {
  const { t, number, language } = useLocalization();
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
            <View
              key={section.key}
              className="flex-row justify-between gap-md"
              accessible
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
            </View>
          ))}
        </View>
      ))}
      {!distributions.some((group) => group.sections.some((section) => section.count > 0)) ? (
        <Text tone="secondary">{t('analytics.boxEmpty')}</Text>
      ) : null}
    </Card>
  );
}
