import { useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useThemeColors } from '@/shared/theme/theme-provider';
import { radii, spacing } from '@/shared/theme/tokens';
import { Card } from '@/shared/ui/card';

interface FlipCardProps {
  readonly revealed: boolean;
  readonly front: ReactNode;
  readonly back: ReactNode;
  readonly accessibilityLabel: string;
}

const perspective = 900;
const flipTiming = { duration: 300, easing: Easing.inOut(Easing.cubic) };

/** Visual transition only. The caller owns reveal state and all study behavior. */
export function FlipCard(props: FlipCardProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <Card
        className="min-h-0 flex-1"
        style={{ minHeight: 260 }}
        accessibilityLabel={props.accessibilityLabel}
      >
        {props.revealed ? props.back : props.front}
      </Card>
    );
  }

  return <AnimatedFaces {...props} />;
}

function AnimatedFaces({ revealed, front, back, accessibilityLabel }: FlipCardProps) {
  const colors = useThemeColors();
  // Each new card mounts at its logical face; an old card's rotation never carries over.
  const rotation = useSharedValue(revealed ? 180 : 0);

  useEffect(() => {
    rotation.value = withTiming(revealed ? 180 : 0, flipTiming);
  }, [revealed, rotation]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective }, { rotateY: `${rotation.value}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective }, { rotateY: `${rotation.value + 180}deg` }],
  }));
  const faceSurface = { backgroundColor: colors.surface, borderRadius: radii.lg };

  return (
    <Card
      className="min-h-0 flex-1"
      style={{ padding: 0, minHeight: 260 }}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        testID="flip-card-front"
        style={[styles.face, faceSurface, frontStyle]}
        pointerEvents={revealed ? 'none' : 'auto'}
        importantForAccessibility={revealed ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={revealed}
      >
        {front}
      </Animated.View>
      <Animated.View
        testID="flip-card-back"
        style={[styles.face, faceSurface, backStyle]}
        pointerEvents={revealed ? 'auto' : 'none'}
        importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!revealed}
      >
        {back}
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  face: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: spacing.xl,
    backfaceVisibility: 'hidden',
  },
});
