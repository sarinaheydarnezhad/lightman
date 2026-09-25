import { Volume2, VolumeX } from 'lucide-react-native';
import { View } from 'react-native';

import { IconButton } from '@/shared/ui/icon-button';
import { Text } from '@/shared/ui/text';
import { usePronunciation } from './use-pronunciation';

export function PronunciationButton({ text, language }: { text: string; language: string }) {
  const pronunciation = usePronunciation(text, language);
  const speaking = pronunciation.status === 'speaking';
  return (
    <View className="items-start gap-xs">
      <IconButton
        icon={speaking ? VolumeX : Volume2}
        label={`${speaking ? 'Stop pronunciation of' : 'Pronounce'} ${text}`}
        accessibilityHint="Uses a voice installed on your device"
        accessibilityState={{ selected: speaking, busy: pronunciation.status === 'stopping' }}
        disabled={pronunciation.status === 'stopping' || !text.trim()}
        onPress={() => void pronunciation.press()}
      />
      {pronunciation.error ? (
        <Text variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
          {pronunciation.error}
        </Text>
      ) : null}
    </View>
  );
}
