import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useReducedMotion, withTiming } from 'react-native-reanimated';

import { makeCard, makeDeck } from '@/../test/fixtures';
import { ThemeProvider } from '@/shared/theme/theme-provider';
import { haptics } from '@/core/composition/haptics';
import { StudyCard } from './study-card';

jest.mock('@/core/composition/haptics', () => ({
  haptics: jest
    .requireActual<typeof import('@/../test/fake-haptics')>('@/../test/fake-haptics')
    .createFakeHaptics().service,
}));

type SwipeEvent = { translationX: number; translationY: number; velocityX: number };
type PanHandlers = {
  enabled?: boolean;
  onBegin?: () => void;
  onUpdate?: (event: SwipeEvent) => void;
  onEnd?: (event: SwipeEvent) => void;
  onFinalize?: () => void;
};

const mockPans: PanHandlers[] = [];
jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: () => {
      const callbacks: PanHandlers = {};
      mockPans.push(callbacks);
      const pan = {
        withTestId: () => pan,
        enabled: (enabled: boolean) => {
          callbacks.enabled = enabled;
          return pan;
        },
        activeOffsetX: () => pan,
        failOffsetY: () => pan,
        onBegin: (callback: PanHandlers['onBegin']) => {
          callbacks.onBegin = callback;
          return pan;
        },
        onUpdate: (callback: PanHandlers['onUpdate']) => {
          callbacks.onUpdate = callback;
          return pan;
        },
        onEnd: (callback: PanHandlers['onEnd']) => {
          callbacks.onEnd = callback;
          return pan;
        },
        onFinalize: (callback: PanHandlers['onFinalize']) => {
          callbacks.onFinalize = callback;
          return pan;
        },
      };
      return pan;
    },
  },
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
}));

const card = makeCard();
const deck = makeDeck({ textAlignment: 'rtl' });

function show(overrides: Partial<Parameters<typeof StudyCard>[0]> = {}) {
  const onSwipeStart = jest.fn();
  const onSwipeAnswer = jest.fn();
  const props = {
    card,
    deck,
    revealed: true,
    backTab: 'meaning' as const,
    onSelectBackTab: jest.fn(),
    onSwipeStart,
    onSwipeAnswer,
    ...overrides,
  };
  const rendered = render(
    <ThemeProvider>
      <StudyCard {...props} />
    </ThemeProvider>,
  );
  fireEvent(screen.getByTestId('study-swipe-card'), 'layout', {
    nativeEvent: { layout: { width: 320 } },
  });
  return { ...rendered, props, onSwipeStart, onSwipeAnswer };
}

function drag(x: number, velocityX = 0, translationY = 0) {
  const pan = mockPans.at(-1)!;
  const event = { translationX: x, translationY, velocityX };
  act(() => {
    pan.onBegin?.();
    pan.onUpdate?.(event);
    pan.onEnd?.(event);
    pan.onFinalize?.();
  });
  return pan;
}

beforeEach(() => {
  mockPans.length = 0;
  jest.mocked(haptics.swipeCommit).mockClear();
  jest.mocked(useReducedMotion).mockReturnValue(false);
});

test('unrevealed cards disable the pan and cannot submit a gesture', () => {
  const { onSwipeStart, onSwipeAnswer } = show({ revealed: false });
  expect(mockPans.at(-1)?.enabled).toBe(false);
  drag(150);
  expect(onSwipeStart).not.toHaveBeenCalled();
  expect(onSwipeAnswer).not.toHaveBeenCalled();
});

test.each([
  [-110, 'failure'],
  [110, 'success'],
] as const)('RTL card swiped %i submits physical %s exactly once', (x, result) => {
  const { onSwipeStart, onSwipeAnswer } = show();
  const pan = drag(x);
  expect(onSwipeStart).toHaveBeenCalledTimes(1);
  expect(onSwipeAnswer).toHaveBeenCalledTimes(1);
  expect(onSwipeAnswer).toHaveBeenCalledWith(result);
  act(() => pan.onEnd?.({ translationX: -x, translationY: 0, velocityX: 0 }));
  expect(onSwipeAnswer).toHaveBeenCalledTimes(1);
});

test('short or vertical swipes return to center with the answer still revealed', () => {
  const { onSwipeAnswer } = show();
  drag(40);
  drag(-110, 0, 100);
  expect(onSwipeAnswer).not.toHaveBeenCalled();
  expect(haptics.swipeCommit).not.toHaveBeenCalled();
  expect(screen.getByText('greeting')).toBeTruthy();
});

test('crossing, retreating and recrossing gives one threshold cue per gesture, not per frame', () => {
  const { onSwipeAnswer } = show();
  const pan = mockPans.at(-1)!;
  act(() => {
    pan.onBegin?.();
    for (const translationX of [20, 90, 110, 40, 100, 120]) {
      pan.onUpdate?.({ translationX, translationY: 0, velocityX: 0 });
    }
    pan.onEnd?.({ translationX: 40, translationY: 0, velocityX: 0 });
    pan.onFinalize?.();
  });
  expect(haptics.swipeCommit).toHaveBeenCalledTimes(1);
  expect(onSwipeAnswer).not.toHaveBeenCalled();
  drag(110);
  expect(haptics.swipeCommit).toHaveBeenCalledTimes(2);
  expect(onSwipeAnswer).toHaveBeenCalledTimes(1);
});

test('pending answers disable gestures; remount after a failed submission unlocks retry', () => {
  const { rerender, props, onSwipeAnswer } = show();
  drag(110);
  rerender(
    <ThemeProvider>
      <StudyCard {...props} swipePending />
    </ThemeProvider>,
  );
  expect(mockPans.at(-1)?.enabled).toBe(false);
  rerender(
    <ThemeProvider>
      <StudyCard {...props} key="submission-failed" swipePending={false} />
    </ThemeProvider>,
  );
  expect(mockPans.at(-1)?.enabled).toBe(true);
  fireEvent(screen.getByTestId('study-swipe-card'), 'layout', {
    nativeEvent: { layout: { width: 320 } },
  });
  drag(-110);
  expect(onSwipeAnswer).toHaveBeenCalledTimes(2);
});

test('a new presentation starts centered and on its front face', () => {
  const { rerender, props } = show();
  drag(110);
  rerender(
    <ThemeProvider>
      <StudyCard
        {...props}
        key="next-presentation"
        card={makeCard({ id: 'another-card', frontText: 'next question' })}
        revealed={false}
      />
    </ThemeProvider>,
  );
  expect(screen.getByRole('header', { name: 'next question' })).toBeTruthy();
  expect(mockPans.at(-1)?.enabled).toBe(false);
  expect(screen.getByTestId('study-swipe-card').props.style.transform[0]).toEqual({
    translateX: 0,
  });
});

test('reduced motion submits without an off-screen timing animation', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true);
  const { onSwipeAnswer } = show();
  const before = jest.mocked(withTiming).mock.calls.length;
  drag(110);
  expect(jest.mocked(withTiming).mock.calls.length).toBe(before);
  expect(onSwipeAnswer).toHaveBeenCalledWith('success');
});

test('a committed swipe does not submit after the card unmounts', () => {
  let finish: (() => void) | undefined;
  const { onSwipeAnswer, unmount } = show();
  jest.mocked(withTiming).mockImplementationOnce((value, _config, completed) => {
    finish = () => completed?.(true);
    return value;
  });
  drag(110);
  expect(onSwipeAnswer).not.toHaveBeenCalled();
  unmount();
  act(() => finish?.());
  expect(onSwipeAnswer).not.toHaveBeenCalled();
});

test('feedback is visual only; accessible answer and button controls remain separate', () => {
  show();
  expect(screen.queryByText('← Failure')).toBeNull();
  expect(screen.getByText('greeting')).toBeTruthy();
  expect(Gesture.Pan).toBeDefined();
});
