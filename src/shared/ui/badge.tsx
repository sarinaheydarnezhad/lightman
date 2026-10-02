import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './text';

export type SemanticVariant = 'neutral' | 'primary' | 'success' | 'error' | 'warning' | 'info';

const appearance = {
  neutral: 'border-border bg-surfaceElevated',
  primary: 'border-primary/25 bg-primarySoft',
  success: 'border-success/25 bg-success/10',
  error: 'border-error/25 bg-error/10',
  warning: 'border-warning/25 bg-warning/10',
  info: 'border-info/25 bg-info/10',
};

const foreground = {
  neutral: 'primaryText',
  primary: 'primary',
  success: 'success',
  error: 'error',
  warning: 'warning',
  info: 'info',
} as const;

export function Badge({
  label,
  variant = 'neutral',
  accessibilityLabel,
  style,
}: {
  label: string;
  variant?: SemanticVariant;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      className={`max-w-full self-start rounded-full border px-md py-xs ${appearance[variant]}`}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <Text variant="caption" tone={foreground[variant]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}
