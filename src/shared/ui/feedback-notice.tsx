import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';

import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from './button';
import { Text } from './text';

/** Task-owned feedback: no queue, timeout, focus theft or implicit acknowledgement. */
export function FeedbackNotice({
  message,
  title,
  tone = 'error',
  eventKey = message,
  enabled = true,
  busy = false,
  children,
  onDismiss,
  onRetry,
  retryLabel,
}: {
  message?: string | null;
  title?: string;
  tone?: 'error' | 'success' | 'info' | 'warning';
  eventKey?: unknown;
  enabled?: boolean;
  busy?: boolean;
  children?: ReactNode;
  onDismiss?: () => void;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const { t } = useLocalization();
  const announced = useRef<{ eventKey: unknown } | null>(null);
  useEffect(() => {
    if (!enabled || !message) {
      announced.current = null;
      return;
    }
    if (announced.current && Object.is(announced.current.eventKey, eventKey)) return;
    announced.current = { eventKey };
    // Android uses the live region below. Avoid announcing twice on either platform.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(message);
  }, [enabled, message, eventKey]);
  if (!enabled || !message) return null;

  return (
    <View className="gap-sm rounded-sm bg-surfaceElevated p-lg" testID="feedback-notice">
      {title ? (
        <Text variant="headingSmall" tone={tone} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <Text tone={title ? 'primary' : tone} accessibilityLiveRegion="polite">
        {message}
      </Text>
      {children}
      {onRetry ? (
        <Button
          label={retryLabel ?? t('common.tryAgain')}
          variant="secondary"
          disabled={busy}
          onPress={onRetry}
        />
      ) : null}
      {onDismiss ? (
        <Button label={t('common.close')} variant="tertiary" disabled={busy} onPress={onDismiss} />
      ) : null}
    </View>
  );
}
