import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './text';

export type SemanticVariant = 'neutral' | 'primary' | 'success' | 'error' | 'warning';

const appearance = {
  neutral: 'border-border bg-surfaceElevated',
  primary: 'border-primary bg-primary',
  success: 'border-success bg-success',
  error: 'border-error bg-error',
  warning: 'border-warning bg-warning',
};

const foreground = {
  neutral: 'primaryText',
  primary: 'primaryForeground',
  success: 'successForeground',
  error: 'errorForeground',
  warning: 'warningForeground',
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
