import { View } from 'react-native';
import type { StudyProgress } from '../application/create-study-use-cases';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';

export function StudyResultSummary({ progress }: { progress: StudyProgress }) {
  const { t, number } = useLocalization();
  const minutes = Math.ceil((progress.durationMs ?? 0) / 60000);
  return (
    <Card className="gap-lg">
      <View
        className="gap-xs"
        accessible
        accessibilityLabel={t(
          progress.uniqueCardsStudied === 1 ? 'review.cardReviewed' : 'review.cardsReviewed',
          { count: number(progress.uniqueCardsStudied) },
        )}
      >
        <Text variant="headingLarge">{number(progress.uniqueCardsStudied)}</Text>
        <Text variant="bodySmall" tone="secondary">
          {t('study.cardsStudiedLabel')}
        </Text>
      </View>
      <View className="gap-sm">
        <Text variant="bodySmall" tone="secondary">
          {t('review.initialRecall')}
        </Text>
        <Text tone="success">
          {t('review.correct', { count: number(progress.successfulInitialAnswers) })}
        </Text>
        <Text>{t('review.failed', { count: number(progress.failedInitialAnswers) })}</Text>
      </View>
      <View className="gap-sm border-t border-border pt-lg">
        <Text variant="bodySmall" tone="secondary">
          {t('study.retries', { count: number(progress.retryCount) })}
        </Text>
        <Text variant="bodySmall" tone="secondary">
          {t('study.time', {
            value:
              minutes < 1
                ? t('study.underMinute')
                : t(minutes === 1 ? 'study.minute' : 'study.minutes', { count: number(minutes) }),
          })}
        </Text>
      </View>
    </Card>
  );
}
