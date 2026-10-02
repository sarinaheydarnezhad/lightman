import { router } from 'expo-router';
import { View } from 'react-native';

import { tabScreenEdges } from '@/shared/navigation/safe-area';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from '@/shared/ui/button';
import { Screen } from '@/shared/ui/screen';
import { ScreenHeader } from '@/shared/ui/screen-header';
import { Text } from '@/shared/ui/text';
import { useStartStudy, openStudySession } from './use-start-study';

export function StudyScreen() {
  const { t, language } = useLocalization();
  const study = useStartStudy();

  return (
    <Screen scroll edges={tabScreenEdges}>
      <View className="gap-2xl pb-xl">
        <ScreenHeader title={t('nav.study')} description={t('study.description')} />
        <View className="gap-lg py-xl">
          <Text variant="headingMedium" accessibilityRole="header">
            {t('study.ready')}
          </Text>
          <Text tone="secondary">{t('study.instructions')}</Text>
          <Button
            label={t('study.start')}
            loading={study.starting}
            onPress={() => void study.start({ kind: 'all-decks' })}
          />
          <Text variant="bodySmall" tone="tertiary">
            {t('study.allDecks')}
          </Text>
        </View>
        {study.error ? (
          <View className="gap-sm" accessibilityLiveRegion="polite">
            <Text tone="error">{language === 'en' ? study.error : t('common.genericError')}</Text>
            {study.activeSession ? (
              <Button
                label={t('study.resume')}
                variant="secondary"
                onPress={() => openStudySession(study.activeSession!)}
              />
            ) : null}
          </View>
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
