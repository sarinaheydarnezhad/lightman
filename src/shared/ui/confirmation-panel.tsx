import { useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './button';
import { Card } from './card';
import { Text } from './text';

export function ConfirmationPanel({
  title,
  description,
  cancelLabel,
  confirmLabel,
  busy = false,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const heading = useRef<View>(null);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
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
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <Card
            className="gap-md"
            style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}
            accessibilityViewIsModal
            importantForAccessibility="yes"
          >
            <View
              ref={heading}
              collapsable={false}
              accessible
              accessibilityRole="header"
              tabIndex={Platform.OS === 'web' ? -1 : undefined}
              accessibilityLabel={title}
            >
              <Text variant="headingSmall">{title}</Text>
            </View>
            <Text tone="secondary">{description}</Text>
            {error ? (
              <Text tone="error" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            <Button label={cancelLabel} variant="secondary" disabled={busy} onPress={onCancel} />
            <Button label={confirmLabel} variant="destructive" loading={busy} onPress={onConfirm} />
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
