import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { useReducedMotion, withTiming } from 'react-native-reanimated';

import { makeCard, makeDeck } from '@/../test/fixtures';
import { ThemeProvider } from '@/shared/theme/theme-provider';
import { palette } from '@/shared/theme/tokens';
import { useUiStore } from '@/store/ui-store';
import { StudyCard } from './study-card';
import { StudyControls } from './study-controls';

const card = makeCard({
  phonetic: '/hello/',
  category: 'Greetings',
  examples: [
    { sentence: 'Hello, friend.', translation: 'A friendly greeting.' },
    { sentence: 'A second example.', notes: 'Conversation.' },
  ],
});

beforeEach(() => jest.mocked(useReducedMotion).mockReturnValue(false));
afterEach(() => useUiStore.setState({ themePreference: 'system' }));

function show(overrides: Partial<Parameters<typeof StudyCard>[0]> = {}) {
  const select = jest.fn();
  render(
    <ThemeProvider>
      <StudyCard
        card={card}
        deck={makeDeck()}
        revealed={false}
        backTab="meaning"
        onSelectBackTab={select}
        {...overrides}
      />
    </ThemeProvider>,
  );
  return select;
}

test('question shows the term and optional front content without revealing the answer', () => {
  show();
  expect(screen.getByRole('header', { name: 'hello' })).toBeTruthy();
  expect(screen.getByText('/hello/')).toBeTruthy();
  expect(screen.getByText('Greetings')).toBeTruthy();
  expect(screen.queryByText('greeting')).toBeNull();
  expect(screen.queryByRole('tab', { name: 'Examples' })).toBeNull();
});

test('revealed answer shows Meaning and switches to multiple Examples without submitting', () => {
  const select = show({ revealed: true });
  expect(screen.getByRole('tab', { name: 'Meaning', selected: true })).toBeTruthy();
  expect(screen.getByText('greeting')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'Examples' }));
  expect(select).toHaveBeenCalledWith('examples');
  // The caller controls the active tab; this component never advances a study session.
});

test('multiple examples show optional translation and notes', () => {
  const rendered = show({ revealed: true, backTab: 'examples' });
  expect(screen.getByText('Hello, friend.')).toBeTruthy();
  expect(screen.getByText('A friendly greeting.')).toBeTruthy();
  expect(screen.getByText('Conversation.')).toBeTruthy();
  expect(rendered).not.toHaveBeenCalled();
});

test.each([
  ['ltr', 'small', 'left', 'text-headingMedium', 'text-bodySmall'],
  ['rtl', 'large', 'right', 'text-display', 'text-bodyLarge'],
  ['center', 'medium', 'center', 'text-headingLarge', 'text-bodyMedium'],
] as const)(
  'deck %s / %s controls only card alignment and semantic typography',
  (direction, size, alignment, frontClass, backClass) => {
    show({ deck: makeDeck({ textAlignment: direction, typographySize: size }) });
    expect(screen.getByRole('header', { name: 'hello' }).props.style).toMatchObject({
      textAlign: alignment,
    });
    expect(screen.getByRole('header', { name: 'hello' }).props.className).toContain(frontClass);
    expect(screen.getByText('greeting', { includeHiddenElements: true }).props.className).toContain(
      backClass,
    );
  },
);

test('missing optional fields are omitted and no examples are fabricated', () => {
  show({
    card: makeCard({ phonetic: null, category: null, examples: [] }),
    revealed: true,
    backTab: 'examples',
  });
  expect(screen.queryByText('/hello/')).toBeNull();
  expect(screen.queryByText('Greetings')).toBeNull();
  expect(screen.getByText('No examples added yet.')).toBeTruthy();
});

test('long study content remains inside a scrollable card on compact layouts', () => {
  show({
    card: makeCard({ frontText: 'long '.repeat(60), meaning: 'definition '.repeat(100) }),
    revealed: true,
  });
  expect(screen.getByText('definition '.repeat(100))).toBeTruthy();
  expect(screen.UNSAFE_getAllByType(ScrollView)).toHaveLength(2);
  for (const scroll of screen.UNSAFE_getAllByType(ScrollView)) {
    expect(scroll.props.style).toMatchObject({ flex: 1 });
  }
});

test('front and back occupy separate faces and only the logical face is accessible', () => {
  const { rerender } = render(
    <ThemeProvider>
      <StudyCard
        card={card}
        deck={makeDeck()}
        revealed={false}
        backTab="meaning"
        onSelectBackTab={jest.fn()}
      />
    </ThemeProvider>,
  );
  const front = screen.getByTestId('flip-card-front');
  const back = screen.getByTestId('flip-card-back', { includeHiddenElements: true });
  expect(front.props.style[2].transform[1]).toEqual({ rotateY: '0deg' });
  expect(back.props.style[2].transform[1]).toEqual({ rotateY: '180deg' });
  expect(front.props.style[0].backfaceVisibility).toBe('hidden');
  expect(back.props.style[0].backfaceVisibility).toBe('hidden');
  expect(front.props.importantForAccessibility).toBe('auto');
  expect(back.props.importantForAccessibility).toBe('no-hide-descendants');
  expect(screen.queryByRole('tab', { name: 'Meaning' })).toBeNull();

  rerender(
    <ThemeProvider>
      <StudyCard
        card={card}
        deck={makeDeck()}
        revealed
        backTab="meaning"
        onSelectBackTab={jest.fn()}
      />
    </ThemeProvider>,
  );
  expect(withTiming).toHaveBeenCalledWith(180, expect.objectContaining({ duration: 300 }));
  expect(
    screen.getByTestId('flip-card-front', { includeHiddenElements: true }).props
      .importantForAccessibility,
  ).toBe('no-hide-descendants');
  expect(screen.getByTestId('flip-card-back').props.importantForAccessibility).toBe('auto');
  expect(screen.queryByRole('header', { name: 'hello' })).toBeNull();
  expect(screen.getByRole('tab', { name: 'Meaning', selected: true })).toBeTruthy();

  rerender(
    <ThemeProvider>
      <StudyCard
        card={card}
        deck={makeDeck()}
        revealed={false}
        backTab="meaning"
        onSelectBackTab={jest.fn()}
      />
    </ThemeProvider>,
  );
  expect(withTiming).toHaveBeenCalledWith(0, expect.any(Object));
  expect(screen.getByRole('header', { name: 'hello' })).toBeTruthy();
  expect(screen.queryByRole('tab', { name: 'Meaning' })).toBeNull();
});

test('a different card mounts on its front even after the previous one was revealed', () => {
  const { rerender } = render(
    <ThemeProvider>
      <StudyCard
        card={card}
        deck={makeDeck()}
        revealed
        backTab="examples"
        onSelectBackTab={jest.fn()}
      />
    </ThemeProvider>,
  );
  rerender(
    <ThemeProvider>
      <StudyCard
        card={makeCard({ id: 'new', frontText: 'next term' })}
        deck={makeDeck()}
        revealed={false}
        backTab="meaning"
        onSelectBackTab={jest.fn()}
      />
    </ThemeProvider>,
  );
  expect(screen.getByRole('header', { name: 'next term' })).toBeTruthy();
  expect(screen.queryByRole('tab', { name: 'Examples' })).toBeNull();
  expect(screen.getByTestId('flip-card-front').props.style[2].transform[1]).toEqual({
    rotateY: '0deg',
  });
});

test('reduced motion switches the accessible face without a spatial flip', () => {
  jest.mocked(useReducedMotion).mockReturnValue(true);
  const { rerender } = render(
    <ThemeProvider>
      <StudyCard
        card={card}
        deck={makeDeck()}
        revealed={false}
        backTab="meaning"
        onSelectBackTab={jest.fn()}
      />
    </ThemeProvider>,
  );
  expect(screen.getByRole('header', { name: 'hello' })).toBeTruthy();
  expect(screen.queryByTestId('flip-card-front')).toBeNull();
  rerender(
    <ThemeProvider>
      <StudyCard
        card={card}
        deck={makeDeck()}
        revealed
        backTab="meaning"
        onSelectBackTab={jest.fn()}
      />
    </ThemeProvider>,
  );
  expect(screen.getByText('greeting')).toBeTruthy();
  expect(screen.queryByRole('header', { name: 'hello' })).toBeNull();
  expect(screen.queryByTestId('flip-card-back')).toBeNull();
});

test('RTL alignment is preserved on the answer face', () => {
  show({ deck: makeDeck({ textAlignment: 'rtl' }), revealed: true });
  expect(screen.getByText('greeting').props.style).toMatchObject({
    textAlign: 'right',
    writingDirection: 'rtl',
  });
});

test.each(['light', 'dark', 'oled'] as const)(
  '%s surface is opaque on both animated faces',
  (mode) => {
    useUiStore.setState({ themePreference: mode });
    show();
    const front = screen.getByTestId('flip-card-front');
    const back = screen.getByTestId('flip-card-back', { includeHiddenElements: true });
    expect(front.props.style[1].backgroundColor).toBe(palette[mode].surface);
    expect(back.props.style[1].backgroundColor).toBe(palette[mode].surface);
  },
);

test('controls reveal before offering labeled Success and Failure actions', () => {
  const reveal = jest.fn();
  const success = jest.fn();
  const failure = jest.fn();
  const { rerender } = render(
    <ThemeProvider>
      <StudyControls
        revealed={false}
        submitting={false}
        onReveal={reveal}
        onSuccess={success}
        onFailure={failure}
      />
    </ThemeProvider>,
  );
  expect(screen.queryByRole('button', { name: 'Success' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Reveal answer' }));
  expect(reveal).toHaveBeenCalledTimes(1);
  rerender(
    <ThemeProvider>
      <StudyControls
        revealed
        submitting={false}
        onReveal={reveal}
        onSuccess={success}
        onFailure={failure}
      />
    </ThemeProvider>,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Failure' }));
  fireEvent.press(screen.getByRole('button', { name: 'Success' }));
  expect(failure).toHaveBeenCalledTimes(1);
  expect(success).toHaveBeenCalledTimes(1);
  rerender(
    <ThemeProvider>
      <StudyControls
        revealed
        submitting
        onReveal={reveal}
        onSuccess={success}
        onFailure={failure}
      />
    </ThemeProvider>,
  );
  expect(screen.getByRole('button', { name: 'Success' }).props.accessibilityState.busy).toBe(true);
  expect(screen.getByRole('button', { name: 'Failure' }).props.accessibilityState.disabled).toBe(
    true,
  );
});
