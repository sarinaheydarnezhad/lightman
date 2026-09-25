import { Volume2, VolumeX } from 'lucide-react-native';
import { View } from 'react-native';

import { IconButton } from '@/shared/ui/icon-button';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Text } from '@/shared/ui/text';
import { usePronunciation } from './use-pronunciation';

export function PronunciationButton({ text, language }: { text: string; language: string }) {
  const { t, language: uiLanguage } = useLocalization();
  const pronunciation = usePronunciation(text, language);
  const speaking = pronunciation.status === 'speaking';
  return (
    <View className="items-start gap-xs">
      <IconButton
        icon={speaking ? VolumeX : Volume2}
        label={t(speaking ? 'speech.stop' : 'speech.pronounce', { term: text })}
        accessibilityHint={t('speech.voiceHint')}
        accessibilityState={{ selected: speaking, busy: pronunciation.status === 'stopping' }}
        disabled={pronunciation.status === 'stopping' || !text.trim()}
        onPress={() => void pronunciation.press()}
      />
      {pronunciation.error ? (
        <Text variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
          {uiLanguage === 'en' ? pronunciation.error : t('common.genericError')}
        </Text>
      ) : null}
    </View>
  );
}
