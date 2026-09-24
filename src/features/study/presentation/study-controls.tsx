import { View } from 'react-native';

import { Button } from '@/shared/ui/button';

export function StudyControls({
  revealed,
  submitting,
  onReveal,
  onFailure,
  onSuccess,
}: {
  readonly revealed: boolean;
  readonly submitting: boolean;
  readonly onReveal: () => void;
  readonly onFailure: () => void;
  readonly onSuccess: () => void;
}) {
  return revealed ? (
    <View className="flex-row gap-md">
      <Button
        label="Failure"
        variant="secondary"
        disabled={submitting}
        style={{ flex: 1 }}
        onPress={onFailure}
      />
      <Button label="Success" loading={submitting} style={{ flex: 1 }} onPress={onSuccess} />
    </View>
  ) : (
    <Button label="Reveal answer" onPress={onReveal} />
  );
}
