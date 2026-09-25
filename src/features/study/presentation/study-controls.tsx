import { useWindowDimensions, View } from 'react-native';

import { Button } from '@/shared/ui/button';
import { useLocalization } from '@/shared/localization/localization-provider';

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
  const { t } = useLocalization();
  const { fontScale, width } = useWindowDimensions();
  return revealed ? (
    <View className={fontScale >= 1.4 || width < 360 ? 'gap-md' : 'flex-row gap-md'}>
      <Button
        label={t('study.failure')}
        variant="secondary"
        disabled={submitting}
        style={{ flex: 1 }}
        onPress={onFailure}
      />
      <Button
        label={t('study.success')}
        loading={submitting}
        style={{ flex: 1 }}
        onPress={onSuccess}
      />
    </View>
  ) : (
    <Button label={t('study.reveal')} onPress={onReveal} />
  );
}
