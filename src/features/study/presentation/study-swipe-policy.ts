import type { ReviewResult } from '../domain/review';

/** Presentation distances are density-independent points. Physical left/right never follow RTL. */
export const swipeMotion = {
  activation: 12,
  verticalFailure: 14,
  minimumDistance: 56,
  maximumDistance: 128,
  widthFraction: 0.28,
  flickFraction: 0.6,
  flickVelocity: 900,
  horizontalDominance: 1.25,
  maximumTilt: 6,
  exitDuration: 190,
  exitWidthMultiplier: 1.6,
  spring: { damping: 18, stiffness: 220 },
} as const;

export function swipeThreshold(cardWidth: number): number {
  'worklet';
  if (!Number.isFinite(cardWidth) || cardWidth <= 0) return Number.POSITIVE_INFINITY;
  return Math.min(
    swipeMotion.maximumDistance,
    Math.max(swipeMotion.minimumDistance, cardWidth * swipeMotion.widthFraction),
  );
}

export function getSwipeDecision(input: {
  translationX: number;
  translationY: number;
  velocityX: number;
  cardWidth: number;
  revealed: boolean;
  active: boolean;
}): ReviewResult | null {
  'worklet';
  if (!input.revealed || !input.active) return null;
  const { translationX: x, translationY: y, velocityX } = input;
  const threshold = swipeThreshold(input.cardWidth);
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(velocityX) ||
    !Number.isFinite(threshold) ||
    Math.abs(x) < swipeMotion.activation ||
    Math.abs(x) <= Math.abs(y) * swipeMotion.horizontalDominance
  )
    return null;
  const deliberateFlick =
    Math.abs(x) >= threshold * swipeMotion.flickFraction &&
    Math.abs(velocityX) >= swipeMotion.flickVelocity &&
    Math.sign(velocityX) === Math.sign(x);
  if (Math.abs(x) < threshold && !deliberateFlick) return null;
  return x > 0 ? 'success' : 'failure';
}
