import { Volume2 } from 'lucide-react-native';
import { View } from 'react-native';

import { IconButton } from '@/shared/ui/icon-button';
import { useLocalization } from '@/shared/localization/localization-provider';
import { FeedbackModal } from '@/shared/ui/feedback-modal';
import { usePronunciation } from './use-pronunciation';

export function PronunciationButton({ text, language }: { text: string; language: string }) {
  const { t, language: uiLanguage } = useLocalization();
  const pronunciation = usePronunciation(text, language);
  const speaking = pronunciation.status === 'speaking';
  return (
    <View className="items-start gap-xs">
      <IconButton
        icon={Volume2}
        label={t(speaking ? 'speech.stop' : 'speech.pronounce', { term: text })}
        accessibilityHint={t('speech.voiceHint')}
        accessibilityState={{ selected: speaking, busy: pronunciation.status === 'stopping' }}
        disabled={pronunciation.status === 'stopping' || !text.trim()}
        onPress={() => void pronunciation.press()}
      />
      {pronunciation.error ? (
        <FeedbackModal
          message={uiLanguage === 'en' ? pronunciation.error : t('common.genericError')}
        />
      ) : null}
    </View>
  );
}
