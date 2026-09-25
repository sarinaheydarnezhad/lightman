import { useEffect, useRef } from 'react';
import { AccessibilityInfo, BackHandler, findNodeHandle, View } from 'react-native';

import { Button } from './button';
import { Card } from './card';
import { Text } from './text';

/** Inline confirmation with a focused title and an accessible escape action. */
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
  const cancel = useRef(onCancel);
  const pending = useRef(busy);
  useEffect(() => {
    cancel.current = onCancel;
    pending.current = busy;
  }, [onCancel, busy]);
  useEffect(() => {
    const focus = setTimeout(() => {
      const target = findNodeHandle(heading.current);
      if (target) AccessibilityInfo.setAccessibilityFocus(target);
    }, 80);
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!pending.current) cancel.current();
      return true;
    });
    return () => {
      clearTimeout(focus);
      back.remove();
    };
  }, []);

  return (
    <View accessibilityViewIsModal importantForAccessibility="yes">
      <Card className="gap-md">
        <View
          ref={heading}
          collapsable={false}
          accessible
          accessibilityRole="header"
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
    </View>
  );
}
