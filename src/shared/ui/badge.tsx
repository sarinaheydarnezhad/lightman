import { View } from 'react-native';
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
}: {
  label: string;
  variant?: SemanticVariant;
  accessibilityLabel?: string;
}) {
  return (
    <View
      className={`self-start rounded-full border px-md py-xs ${appearance[variant]}`}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
    >
      <Text variant="caption" tone={foreground[variant]}>
        {label}
      </Text>
    </View>
  );
}
