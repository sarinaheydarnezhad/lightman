import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useLocalization } from '@/shared/localization/localization-provider';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { icons } from '@/shared/theme/tokens';
import { Text } from './text';

/** A destination within the current task, visually subordinate to submission. */
export function NavigationRow({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail?: string;
  onPress: () => void;
}) {
  const { direction } = useLocalization();
  const colors = useThemeColors();
  const Chevron = direction === 'rtl' ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      onPress={onPress}
      className={`min-h-listItem items-center gap-md rounded-sm border border-transparent py-md active:bg-surfaceElevated focus:border-primary ${direction === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <View className="min-w-0 flex-1 gap-xs">
        <Text variant="bodyMedium" weight="medium">
          {label}
        </Text>
        {detail ? (
          <Text variant="bodySmall" tone="secondary">
            {detail}
          </Text>
        ) : null}
      </View>
      <Chevron size={icons.medium} color={colors.tertiaryText} />
    </Pressable>
  );
}
