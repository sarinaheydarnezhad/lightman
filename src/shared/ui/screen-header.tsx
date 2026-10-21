import { View } from 'react-native';
import { Text } from './text';

export function PageTitle({
  children,
  variant = 'headingLarge',
}: {
  children: string;
  variant?: 'headingLarge' | 'headingSmall';
}) {
  return (
    <Text
      variant={variant}
      weight="bold"
      accessibilityRole="header"
      style={{ fontWeight: 'normal' }}
    >
      {children}
    </Text>
  );
}

export function ScreenHeader({ title, description }: { title: string; description?: string }) {
  return (
    <View className="gap-sm">
      <PageTitle>{title}</PageTitle>
      {description ? <Text tone="secondary">{description}</Text> : null}
    </View>
  );
}
