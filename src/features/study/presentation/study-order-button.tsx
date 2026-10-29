import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Shuffle } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StudyOrder } from '../domain/study-order';
import { useLocalization } from '@/shared/localization/localization-provider';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { radii } from '@/shared/theme/tokens';
import { Button } from '@/shared/ui/button';
import { Text } from '@/shared/ui/text';

const choices = [
  { order: 'random', icon: Shuffle },
  { order: 'in-order', icon: ArrowDown },
  { order: 'reverse', icon: ArrowUp },
] as const;

export function StudyOrderButton({
  label,
  loading = false,
  disabled = false,
  variant = 'primary',
  onStart,
}: {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  onStart: (order: StudyOrder) => void;
}) {
  const { t, direction } = useLocalization();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const anchor = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [bounds, setBounds] = useState({ x: 16, y: 16, width: 0, height: 0 });
  const rtl = direction === 'rtl';
  const unavailable = loading || disabled;
  const menuWidth = Math.min(240, window.width - 32);
  const rowHeight = Math.max(52, 32 + 22 * window.fontScale);
  const menuHeight = Math.min(
    choices.length * rowHeight + 12,
    window.height - insets.top - insets.bottom - 16,
  );
  const bottom = bounds.y + bounds.height + 8;
  const top = Math.max(
    insets.top + 8,
    Math.min(
      bottom + menuHeight <= window.height - insets.bottom - 8 ? bottom : bounds.y - menuHeight - 8,
      window.height - insets.bottom - menuHeight - 8,
    ),
  );
  const left = Math.max(
    16,
    Math.min(rtl ? bounds.x : bounds.x + bounds.width - menuWidth, window.width - menuWidth - 16),
  );
  const measure = () =>
    anchor.current?.measureInWindow((x, y, width, height) => {
      setBounds({ x, y, width, height });
    });
  return (
    <View ref={anchor} collapsable={false} onLayout={measure}>
      <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'stretch' }}>
        <Button
          label={label}
          variant={variant}
          loading={loading}
          disabled={disabled}
          accessibilityHint={t('study.order.default')}
          onPress={() => onStart('random')}
          style={{
            flex: 1,
            ...(rtl
              ? { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }
              : { borderTopRightRadius: 0, borderBottomRightRadius: 0 }),
          }}
        />
        <Button
          label={t('study.order.choose')}
          icon={ChevronDown}
          iconOnly
          variant={variant}
          accessibilityHint={label}
          accessibilityState={{ expanded: open, disabled: unavailable }}
          disabled={disabled}
          loading={loading}
          onPress={() => {
            measure();
            setOpen(true);
          }}
          style={{
            width: 52,
            flexShrink: 0,
            ...(rtl
              ? {
                  borderTopLeftRadius: radii.md,
                  borderBottomLeftRadius: radii.md,
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  borderRightWidth: 0,
                }
              : {
                  borderTopRightRadius: radii.md,
                  borderBottomRightRadius: radii.md,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  borderLeftWidth: 0,
                }),
          }}
        />
      </View>
      <Modal
        visible={open && !unavailable}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={{ flex: 1 }} accessibilityViewIsModal>
          <Pressable
            style={{ position: 'absolute', inset: 0 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={() => setOpen(false)}
          />
          <View
            accessibilityLabel={t('study.order.choose')}
            style={{
              position: 'absolute',
              top,
              left,
              width: menuWidth,
              paddingVertical: 6,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radii.sm,
              boxShadow: '0 6px 24px rgba(0, 0, 0, 0.16)',
            }}
          >
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: menuHeight - 12 }}>
              {choices.map(({ order, icon: Icon }) => (
                <Pressable
                  key={order}
                  accessibilityRole="menuitem"
                  accessibilityLabel={t(`study.order.${order}`)}
                  onPress={() => {
                    setOpen(false);
                    onStart(order);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: rtl ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 16,
                    minHeight: rowHeight,
                    backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
                  })}
                >
                  <Icon size={20} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.primaryText,
                      flex: 1,
                      textAlign: rtl ? 'right' : 'left',
                    }}
                  >
                    {t(`study.order.${order}`)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
