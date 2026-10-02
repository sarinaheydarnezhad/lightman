import { View } from 'react-native';

export function Progress({ value, label }: { value: number; label: string }) {
  const fraction = Number.isFinite(value) ? Math.max(0, Math.min(value, 1)) : 0;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
      className="h-sm overflow-hidden rounded-full bg-surfaceElevated"
    >
      <View className="h-full rounded-full bg-primary" style={{ width: `${fraction * 100}%` }} />
    </View>
  );
}
