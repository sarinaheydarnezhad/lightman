import { useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './button';
import { Card } from './card';
import { Text } from './text';
import { useThemeVariables } from '@/shared/theme/theme-provider';

export function ConfirmationPanel({
  title,
  description,
  cancelLabel,
  confirmLabel,
  destructive = true,
  busy = false,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const heading = useRef<View>(null);
  const themeVariables = useThemeVariables();

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
      <SafeAreaView className="flex-1 justify-center bg-overlay/60 p-lg" style={themeVariables}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <Card
            variant="elevated"
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
            <Button label={cancelLabel} variant="tertiary" disabled={busy} onPress={onCancel} />
            <Button
              label={confirmLabel}
              variant={destructive ? 'destructive' : 'primary'}
              loading={busy}
              onPress={onConfirm}
            />
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
