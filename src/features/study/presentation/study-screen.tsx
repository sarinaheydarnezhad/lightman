import { router } from 'expo-router';
import { View } from 'react-native';

import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useStartStudy, openStudySession } from './use-start-study';

export function StudyScreen() {
  const { t, language } = useLocalization();
  const study = useStartStudy();

  return (
    <Screen scroll edges={tabScreenEdges}>
      <View className="gap-2xl">
        <ScreenHeader title={t('nav.study')} description={t('study.description')} />
        <Card className="gap-lg">
          <Badge label={t('study.allDecks')} />
          <Text variant="headingMedium" accessibilityRole="header">
            {t('study.ready')}
          </Text>
          <Text tone="secondary">{t('study.instructions')}</Text>
          <Button
            label={t('study.start')}
            loading={study.starting}
            onPress={() => void study.start({ kind: 'all-decks' })}
          />
        </Card>
        {study.error ? (
          <Card className="gap-md" accessibilityLiveRegion="polite">
            <Text tone="error">{language === 'en' ? study.error : t('common.genericError')}</Text>
            {study.activeSession ? (
              <Button
                label={t('study.resume')}
                variant="secondary"
                onPress={() => openStudySession(study.activeSession!)}
              />
            ) : null}
          </Card>
        ) : null}
        <Button
          label={t('common.browseDecks')}
          variant="tertiary"
          onPress={() => router.push('/decks')}
        />
      </View>
    </Screen>
  );
}
