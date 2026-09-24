import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import { makeCard, makeDeck } from '@/../test/fixtures';
import { ThemeProvider } from '@/shared/theme/theme-provider';
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
    show({ deck: makeDeck({ textAlignment: direction, typographySize: size }), revealed: true });
    expect(screen.getByRole('header', { name: 'hello' }).props.style).toMatchObject({
      textAlign: alignment,
    });
    expect(screen.getByRole('header', { name: 'hello' }).props.className).toContain(frontClass);
    expect(screen.getByText('greeting').props.className).toContain(backClass);
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
  expect(screen.UNSAFE_getByType(ScrollView).props.style).toMatchObject({ flex: 1 });
});

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
