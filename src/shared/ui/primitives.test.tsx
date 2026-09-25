import { fireEvent, render, screen } from '@testing-library/react-native';
import { Settings2 } from 'lucide-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Button } from './button';
import { Card } from './card';
import { IconButton } from './icon-button';
import { Input } from './input';
import { Screen } from './screen';
import { Tab } from './tab';
import { Text } from './text';

test('button supports normal, disabled, loading and destructive states', () => {
  const onPress = jest.fn();
  const { rerender } = render(<Button label="Continue" onPress={onPress} />);
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(onPress).toHaveBeenCalledTimes(1);

  rerender(<Button label="Continue" onPress={onPress} disabled />);
  expect(screen.getByRole('button', { name: 'Continue', disabled: true })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(onPress).toHaveBeenCalledTimes(1);

  rerender(<Button label="Continue" loading onPress={onPress} />);
  expect(screen.getByRole('button', { name: 'Continue', disabled: true, busy: true })).toBeTruthy();

  rerender(<Button label="Remove" variant="destructive" onPress={onPress} />);
  expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();

  rerender(<Button label="English" accessibilityState={{ selected: true }} />);
  expect(screen.getByRole('button', { name: 'English', selected: true })).toBeTruthy();
  expect(screen.getByText('✓')).toBeTruthy();
});

test('input exposes label, helper or error, editable state and multiline configuration', () => {
  const { rerender } = render(
    <Input label="Word" helperText="Optional" placeholder="Enter a word" />,
  );
  expect(screen.getByLabelText('Word')).toBeTruthy();
  expect(screen.getByText('Optional')).toBeTruthy();

  rerender(<Input label="Word" error="Required" disabled multiline textAlign="center" />);
  expect(screen.getByText('Required')).toBeTruthy();
  expect(screen.queryByText('Optional')).toBeNull();
  expect(screen.getByLabelText('Word').props.editable).toBe(false);
  expect(screen.getByLabelText('Word').props.multiline).toBe(true);
  expect(screen.getByLabelText('Word').props.textAlign).toBe('center');
  expect(screen.getByLabelText('Word').props.accessibilityHint).toBe('Error: Required');
});

test('icon-only buttons expose an accessible label and disabled state', () => {
  render(<IconButton icon={Settings2} label="Settings" disabled />);
  expect(screen.getByRole('button', { name: 'Settings', disabled: true })).toBeTruthy();
});

test('interactive cards keep their pressed surface and expose caller roles and state', () => {
  const onPress = jest.fn();
  const { rerender } = render(
    <Card variant="interactive" accessibilityLabel="Open deck" onPress={onPress}>
      <Text>Deck</Text>
    </Card>,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Open deck' }));
  expect(onPress).toHaveBeenCalledTimes(1);

  rerender(
    <Card
      variant="interactive"
      accessibilityRole="switch"
      accessibilityLabel="Reminder"
      accessibilityState={{ checked: true, busy: true }}
      disabled
      onPress={onPress}
    >
      <Text>On</Text>
    </Card>,
  );
  const reminder = screen.getByRole('switch', { name: 'Reminder', disabled: true, busy: true });
  expect(reminder.props.accessibilityState).toMatchObject({ checked: true, busy: true });
  fireEvent.press(reminder);
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('tabs expose selected and disabled semantics', () => {
  render(
    <>
      <Tab label="Meaning" active />
      <Tab label="Examples" />
      <Tab label="Unavailable" disabled />
    </>,
  );
  expect(screen.getByRole('tab', { name: 'Meaning', selected: true })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Examples', selected: false })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Unavailable', disabled: true })).toBeTruthy();
  expect(screen.getByText('Meaning').props.numberOfLines).toBeUndefined();
});

test('screen renders content inside a safe area in both layouts', () => {
  const initialMetrics = {
    frame: { x: 0, y: 0, width: 320, height: 640 },
    insets: { top: 24, right: 0, bottom: 16, left: 0 },
  };
  const { rerender } = render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <Screen testID="screen">
        <Text>Content</Text>
      </Screen>
    </SafeAreaProvider>,
  );
  expect(screen.getByTestId('screen')).toBeTruthy();
  expect(screen.getByText('Content')).toBeTruthy();
  rerender(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <Screen scroll testID="screen">
        <Text>Scrollable</Text>
      </Screen>
    </SafeAreaProvider>,
  );
  expect(screen.getByText('Scrollable')).toBeTruthy();
});
