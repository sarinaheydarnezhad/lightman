import { router } from 'expo-router';
import { FeedbackModal } from '@/shared/ui/feedback-modal';
import { View } from 'react-native';

import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useStartStudy, openStudySession } from './use-start-study';
import { StudyOrderButton } from './study-order-button';

export function StudyScreen() {
  const { t, language } = useLocalization();
  const study = useStartStudy();

  return (
    <Screen scroll edges={tabScreenEdges}>
      <View className="gap-2xl pb-xl">
        <ScreenHeader title={t('nav.study')} description={t('study.description')} />
        <Card className="gap-lg">
          <Text variant="headingMedium" accessibilityRole="header">
            {t('study.ready')}
          </Text>
          <Text tone="secondary">{t('study.instructions')}</Text>
          <StudyOrderButton
            label={t('study.start')}
            loading={study.starting}
            onStart={(order) => void study.start({ kind: 'all-decks' }, false, order)}
          />
          <Text variant="bodySmall" tone="tertiary">
            {t('study.allDecks')}
          </Text>
        </Card>
        {study.error ? (
          <FeedbackModal message={language === 'en' ? study.error : t('common.genericError')}>
            {study.activeSession ? (
              <Button
                label={t('study.resume')}
                variant="secondary"
                onPress={() => openStudySession(study.activeSession!)}
              />
            ) : null}
          </FeedbackModal>
        ) : null}
        <Button
          label={t('common.browseDecks')}
          variant="ghost"
          onPress={() => router.push('/decks')}
        />
      </View>
    </Screen>
  );
}
