import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Shuffle } from 'lucide-react-native';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StudyOrder } from '../domain/study-order';
import { useLocalization } from '@/shared/localization/localization-provider';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { heights, interaction, radii } from '@/shared/theme/tokens';
import { Text } from '@/shared/ui/text';

const choices = [
  { order: 'random', icon: Shuffle },
  { order: 'in-order', icon: ArrowDown },
  { order: 'reverse', icon: ArrowUp },
] as const;

// Keep layout in concrete styles: NativeWind can discard Pressable style callbacks.
function InteractiveSurface({
  activeColor,
  style,
  disabled,
  ...props
}: Omit<PressableProps, 'style'> & { activeColor: string; style?: StyleProp<ViewStyle> }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      {...props}
      disabled={disabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        style,
        !disabled && (hovered || focused || pressed) && { backgroundColor: activeColor },
      ]}
    />
  );
}

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
  const background = disabled
    ? colors.surfaceElevated
    : variant === 'primary'
      ? colors.primary
      : colors.surface;
  const foreground = disabled
    ? colors.disabled
    : variant === 'primary'
      ? colors.primaryForeground
      : colors.primaryText;
  const activeColor = variant === 'primary' ? colors.primaryPressed : colors.surfaceElevated;
  const menuWidth = Math.min(Math.max(bounds.width, 240), 320, window.width - 32);
  const rowHeight = Math.max(56, 24 + 23 * window.fontScale);
  const menuHeight = Math.min(
    choices.length * rowHeight + 16 + 18 * window.fontScale + 16,
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
    <View ref={anchor} collapsable={false} onLayout={measure} style={styles.container}>
      <View
        style={[
          styles.splitButton,
          {
            flexDirection: rtl ? 'row-reverse' : 'row',
            backgroundColor: background,
            borderColor: variant === 'primary' && !disabled ? colors.primary : colors.border,
            opacity: disabled ? interaction.disabledOpacity : 1,
          },
        ]}
      >
        <InteractiveSurface
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: unavailable, busy: loading }}
          accessibilityHint={t('study.order.default')}
          disabled={unavailable}
          activeColor={activeColor}
          onPress={() => onStart('random')}
          style={[styles.startAction, { flexDirection: rtl ? 'row-reverse' : 'row' }]}
        >
          {loading ? <ActivityIndicator size="small" color={foreground} /> : null}
          <Text variant="labelLarge" align="center" style={{ color: foreground, flexShrink: 1 }}>
            {label}
          </Text>
        </InteractiveSurface>
        <View
          importantForAccessibility="no-hide-descendants"
          style={[styles.separator, { backgroundColor: foreground }]}
        />
        <InteractiveSurface
          accessibilityRole="button"
          accessibilityLabel={t('study.order.choose')}
          accessibilityHint={label}
          aria-haspopup="menu"
          accessibilityState={{ expanded: open, disabled: unavailable }}
          disabled={unavailable}
          activeColor={activeColor}
          onPress={() => {
            measure();
            setOpen(true);
          }}
          style={styles.orderAction}
        >
          <ChevronDown
            size={22}
            color={foreground}
            style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
          />
        </InteractiveSurface>
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
            accessibilityRole="menu"
            accessibilityLabel={t('study.order.choose')}
            style={{
              position: 'absolute',
              top,
              left,
              width: menuWidth,
              padding: 8,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radii.md,
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.12)',
            }}
          >
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: menuHeight - 16 }}>
              <Text
                variant="caption"
                tone="secondary"
                style={{ paddingHorizontal: 12, paddingVertical: 8 }}
              >
                {t('study.order.choose')}
              </Text>
              {choices.map(({ order, icon: Icon }) => (
                <InteractiveSurface
                  key={order}
                  accessibilityRole="menuitem"
                  accessibilityLabel={t(`study.order.${order}`)}
                  onPress={() => {
                    setOpen(false);
                    onStart(order);
                  }}
                  activeColor={colors.surfaceElevated}
                  style={{
                    flexDirection: rtl ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    minHeight: rowHeight,
                    borderRadius: radii.sm,
                  }}
                >
                  <View
                    style={[styles.icon, { backgroundColor: colors.primarySoft }]}
                    importantForAccessibility="no-hide-descendants"
                  >
                    <Icon size={20} color={colors.primary} />
                  </View>
                  <Text
                    variant="bodyMedium"
                    weight="medium"
                    style={{
                      color: colors.primaryText,
                      flex: 1,
                      textAlign: rtl ? 'right' : 'left',
                    }}
                  >
                    {t(`study.order.${order}`)}
                  </Text>
                </InteractiveSurface>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', alignSelf: 'stretch' },
  splitButton: {
    alignItems: 'stretch',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radii.md,
    minHeight: heights.button,
  },
  startAction: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  orderAction: { width: 56, alignItems: 'center', justifyContent: 'center' },
  separator: { width: 1, marginVertical: 14, opacity: 0.2 },
  icon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
