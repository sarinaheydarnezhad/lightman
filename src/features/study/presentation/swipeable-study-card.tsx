import { useEffect, useId, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { haptics } from '@/core/composition/haptics';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { useLocalization } from '@/shared/localization/localization-provider';
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
  const { t } = useLocalization();
  const reducedMotion = useReducedMotion();
  const { width: screenWidth } = useWindowDimensions();
  // Width is measured on layout, never on a gesture frame.
  const [cardWidth, setCardWidth] = useState(0);
  const translationX = useSharedValue(0);
  const locked = useSharedValue(false);
  const thresholdNotified = useSharedValue(false);
  const mounted = useSharedValue(true);
  useEffect(() => {
    return () => {
      mounted.value = false;
    };
  }, [mounted]);

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
        if (mounted.value) runOnJS(onAnswer)(result);
        return;
      }
      const exit =
        (result === 'success' ? 1 : -1) *
        Math.max(screenWidth, cardWidth) *
        swipeMotion.exitWidthMultiplier;
      translationX.value = withTiming(exit, { duration: swipeMotion.exitDuration }, () => {
        // A committed answer is submitted even if the exit animation is interrupted.
        if (mounted.value) runOnJS(onAnswer)(result);
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
    opacity: revealed
      ? Math.min(1, Math.max(0, translationX.value / swipeThreshold(cardWidth)))
      : 0,
  }));
  const failureStyle = useAnimatedStyle(() => ({
    opacity: revealed
      ? Math.min(1, Math.max(0, -translationX.value / swipeThreshold(cardWidth)))
      : 0,
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
        <SwipeLighting result="failure" color={colors.error} style={failureStyle} />
        <SwipeLighting result="success" color={colors.success} style={successStyle} />
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
            ← {t('study.failure')}
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
            {t('study.success')} →
          </Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

function SwipeLighting({
  result,
  color,
  style,
}: {
  readonly result: ReviewResult;
  readonly color: string;
  readonly style: AnimatedStyle<ViewStyle>;
}) {
  const gradientId = `swipe-light-${useId().replace(/:/g, '')}`;

  return (
    <Animated.View
      testID={`study-swipe-light-${result}`}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: radii.lg,
          borderWidth: 2,
          borderColor: color,
          shadowColor: color,
          shadowOpacity: 0.4,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    >
      <Svg width="100%" height="100%" accessible={false}>
        <Defs>
          <LinearGradient
            id={gradientId}
            x1={result === 'success' ? '0%' : '100%'}
            y1="0%"
            x2={result === 'success' ? '100%' : '0%'}
            y2="0%"
          >
            <Stop offset="0%" stopColor={color} stopOpacity={0.02} />
            <Stop offset="50%" stopColor={color} stopOpacity={0.06} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.28} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" rx={radii.lg} ry={radii.lg} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}
