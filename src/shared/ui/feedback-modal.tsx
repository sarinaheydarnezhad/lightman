import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocalization } from '@/shared/localization/localization-provider';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { Button } from './button';
import { Card } from './card';
import { Text } from './text';

const pending: symbol[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const snapshot = () => pending[0];
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function FeedbackModal({
  message,
  title,
  tone = 'error',
  eventKey = message,
  children,
  onDismiss,
  onRetry,
  retryLabel,
}: {
  message?: string | null;
  title?: string;
  tone?: 'error' | 'success' | 'info' | 'warning';
  eventKey?: unknown;
  children?: ReactNode;
  onDismiss?: () => void;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const { t } = useLocalization();
  const colors = useThemeColors();
  const [identity] = useState(() => Symbol('feedback'));
  const heading = useRef<View>(null);
  const [state, setState] = useState({ message, eventKey, dismissed: false });
  const sameEvent = state.message === message && Object.is(state.eventKey, eventKey);
  if (!sameEvent) setState({ message, eventKey, dismissed: false });
  const dismissed = sameEvent && state.dismissed;
  const active = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (!message || dismissed) return;
    const token = identity;
    pending.push(token);
    notify();
    return () => {
      const position = pending.indexOf(token);
      if (position !== -1) pending.splice(position, 1);
      notify();
    };
  }, [message, eventKey, dismissed, identity]);

  const visible = !!message && !dismissed && active === identity;
  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);
  const close = () => {
    setState({ message, eventKey, dismissed: true });
    onDismiss?.();
  };
  if (!visible)
    return message && dismissed && onRetry ? (
      <Button label={retryLabel ?? t('common.tryAgain')} variant="secondary" onPress={onRetry} />
    ) : null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={close}
      onShow={() => {
        if (Platform.OS === 'web') {
          heading.current?.focus();
          return;
        }
        const target = findNodeHandle(heading.current);
        if (target) AccessibilityInfo.setAccessibilityFocus(target);
      }}
    >
      <SafeAreaView className="flex-1 justify-center bg-overlay/60 p-lg">
        <Card
          className="w-full gap-lg"
          style={{
            maxWidth: 480,
            maxHeight: '90%',
            alignSelf: 'center',
            backgroundColor: colors.surface,
          }}
          accessibilityViewIsModal
          importantForAccessibility="yes"
          testID="feedback-modal"
        >
          <View
            ref={heading}
            accessible
            collapsable={false}
            accessibilityRole="header"
            tabIndex={Platform.OS === 'web' ? -1 : undefined}
            accessibilityLabel={
              title ?? t(tone === 'error' ? 'common.errorTitle' : 'common.noticeTitle')
            }
          >
            <Text variant="headingSmall">
              {title ?? t(tone === 'error' ? 'common.errorTitle' : 'common.noticeTitle')}
            </Text>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
            <View className="gap-md">
              <Text tone={tone === 'info' ? 'primary' : tone} accessibilityRole="alert">
                {message}
              </Text>
              {children}
            </View>
          </ScrollView>
          {onRetry ? (
            <Button
              label={retryLabel ?? t('common.tryAgain')}
              onPress={() => {
                close();
                onRetry();
              }}
            />
          ) : null}
          <Button label={t('common.close')} variant="secondary" onPress={close} />
        </Card>
      </SafeAreaView>
    </Modal>
  );
}
