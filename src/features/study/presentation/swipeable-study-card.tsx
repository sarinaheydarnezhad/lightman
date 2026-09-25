import { useState, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '@/core/composition/haptics';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { radii, spacing } from '@/shared/theme/tokens';
import { Text } from '@/shared/ui/text';
import type { ReviewResult } from '../domain/review';
import { getSwipeDecision, swipeMotion, swipeThreshold } from './study-swipe-policy';

interface SwipeableStudyCardProps {
  readonly children: ReactNode;
  readonly revealed: boolean;
  readonly active: boolean;
  readonly pending: boolean;
  readonly onCommitStart: () => void;
  readonly onAnswer: (result: ReviewResult) => void;
}

/** Physical right = Success and left = Failure, even for RTL card content. */
export function SwipeableStudyCard({
  children,
  revealed,
  active,
  pending,
  onCommitStart,
  onAnswer,
}: SwipeableStudyCardProps) {
  const colors = useThemeColors();
  const reducedMotion = useReducedMotion();
  const { width: screenWidth } = useWindowDimensions();
  // Width is measured on layout, never on a gesture frame.
  const [cardWidth, setCardWidth] = useState(0);
  const translationX = useSharedValue(0);
  const locked = useSharedValue(false);
  const thresholdNotified = useSharedValue(false);
  const notifyThreshold = () => {
    void haptics.swipeCommit();
  };

  const gesture = Gesture.Pan()
    .withTestId('study-swipe-gesture')
    .enabled(revealed && active && !pending)
    .activeOffsetX([-swipeMotion.activation, swipeMotion.activation])
    .failOffsetY([-swipeMotion.verticalFailure, swipeMotion.verticalFailure])
    .onBegin(() => {
      // A drag can cross, retreat, and cross again: one cue per gesture.
      thresholdNotified.value = false;
    })
    .onUpdate((event) => {
      if (locked.value) return;
      translationX.value = event.translationX;
      if (
        !thresholdNotified.value &&
        getSwipeDecision({
          translationX: event.translationX,
          translationY: event.translationY,
          velocityX: 0,
          cardWidth,
          revealed,
          active,
        })
      ) {
        thresholdNotified.value = true;
        runOnJS(notifyThreshold)();
      }
    })
    .onEnd((event) => {
      if (locked.value) return;
      const result = getSwipeDecision({
        translationX: event.translationX,
        translationY: event.translationY,
        velocityX: event.velocityX,
        cardWidth,
        revealed,
        active,
      });
      if (!result) {
        translationX.value = withSpring(0, swipeMotion.spring);
        return;
      }
      locked.value = true;
      runOnJS(onCommitStart)();
      if (reducedMotion) {
        translationX.value = 0;
        runOnJS(onAnswer)(result);
        return;
      }
      const exit =
        (result === 'success' ? 1 : -1) *
        Math.max(screenWidth, cardWidth) *
        swipeMotion.exitWidthMultiplier;
      translationX.value = withTiming(exit, { duration: swipeMotion.exitDuration }, () => {
        // A committed answer is submitted even if the exit animation is interrupted.
        runOnJS(onAnswer)(result);
      });
    })
    .onFinalize(() => {
      if (!locked.value) translationX.value = withSpring(0, swipeMotion.spring);
    });

  const cardStyle = useAnimatedStyle(() => {
    const width = Math.max(cardWidth, 1);
    const tilt = reducedMotion
      ? 0
      : Math.max(
          -swipeMotion.maximumTilt,
          Math.min(swipeMotion.maximumTilt, translationX.value / 20),
        );
    return {
      transform: [
        { translateX: reducedMotion ? translationX.value * 0.15 : translationX.value },
        { rotateZ: `${tilt}deg` },
      ],
      opacity: reducedMotion ? 1 : Math.max(0.78, 1 - Math.abs(translationX.value) / (width * 4)),
    };
  });
  const successStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, translationX.value / swipeThreshold(cardWidth))),
  }));
  const failureStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -translationX.value / swipeThreshold(cardWidth))),
  }));
  const feedbackSurface = {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        testID="study-swipe-card"
        className="min-h-0 flex-1"
        style={cardStyle}
        onLayout={(event) => {
          setCardWidth(event.nativeEvent.layout.width);
        }}
      >
        {children}
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[
            { position: 'absolute', top: spacing.md, left: spacing.md, borderWidth: 1 },
            feedbackSurface,
            failureStyle,
          ]}
        >
          <Text variant="labelMedium" style={{ color: colors.error }}>
            ← Failure
          </Text>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[
            { position: 'absolute', top: spacing.md, right: spacing.md, borderWidth: 1 },
            feedbackSurface,
            successStyle,
          ]}
        >
          <Text variant="labelMedium" style={{ color: colors.success }}>
            Success →
          </Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
