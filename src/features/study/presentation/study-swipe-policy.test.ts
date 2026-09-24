import { getSwipeDecision, swipeMotion, swipeThreshold } from './study-swipe-policy';

const gesture = {
  translationX: 0,
  translationY: 0,
  velocityX: 0,
  cardWidth: 320,
  revealed: true,
  active: true,
};

test.each([
  [220, 61.6],
  [320, 89.6],
  [440, 123.2],
  [720, 128],
])('card width %i uses a reachable proportional threshold', (width, threshold) => {
  expect(swipeThreshold(width)).toBeCloseTo(threshold);
});

test.each([0, -10, Number.NaN, Number.POSITIVE_INFINITY])(
  'unmeasured or invalid card width %s cannot commit',
  (width) => {
    expect(getSwipeDecision({ ...gesture, cardWidth: width, translationX: 200 })).toBeNull();
  },
);

test.each([
  [-96, 'failure'],
  [96, 'success'],
] as const)('physical displacement %i commits %s independently of text direction', (x, result) => {
  expect(getSwipeDecision({ ...gesture, translationX: x })).toBe(result);
});

test('small movements return without answering and leave the revealed card available', () => {
  expect(getSwipeDecision({ ...gesture, translationX: 75 })).toBeNull();
  expect(getSwipeDecision({ ...gesture, translationX: -75 })).toBeNull();
  expect(getSwipeDecision({ ...gesture, translationX: 0, velocityX: 4000 })).toBeNull();
});

test('a sufficiently long flick commits only in its matching direction', () => {
  const distance = swipeThreshold(gesture.cardWidth) * swipeMotion.flickFraction;
  expect(getSwipeDecision({ ...gesture, translationX: distance, velocityX: 910 })).toBe('success');
  expect(getSwipeDecision({ ...gesture, translationX: -distance, velocityX: -910 })).toBe(
    'failure',
  );
  expect(getSwipeDecision({ ...gesture, translationX: distance, velocityX: -2000 })).toBeNull();
  expect(getSwipeDecision({ ...gesture, translationX: distance - 1, velocityX: 2000 })).toBeNull();
});

test('vertical gestures and diagonal scrolling never submit a swipe answer', () => {
  expect(getSwipeDecision({ ...gesture, translationX: 110, translationY: 95 })).toBeNull();
  expect(getSwipeDecision({ ...gesture, translationX: 20, translationY: 140 })).toBeNull();
});

test('revealed active presentation is required for both physical directions', () => {
  for (const x of [-200, 200]) {
    expect(getSwipeDecision({ ...gesture, translationX: x, revealed: false })).toBeNull();
    expect(getSwipeDecision({ ...gesture, translationX: x, active: false })).toBeNull();
  }
});

test('nonfinite displacement and velocity cannot commit', () => {
  expect(getSwipeDecision({ ...gesture, translationX: Number.NaN })).toBeNull();
  expect(getSwipeDecision({ ...gesture, translationX: 200, velocityX: Infinity })).toBeNull();
});
