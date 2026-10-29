import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LocalizationProvider } from '@/shared/localization/localization-provider';
import { translate } from '@/shared/localization/localization';
import { StudyOrderButton } from './study-order-button';

jest.mock('@/core/composition/application', () => ({
  application: {
    settings: {
      snapshot: () => null,
      subscribe: () => () => {},
    },
  },
}));

function show(language: 'en' | 'fa' = 'en', loading = false) {
  const start = jest.fn();
  const view = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <LocalizationProvider language={language}>
        <StudyOrderButton
          label={translate(language, 'study.start')}
          onStart={start}
          loading={loading}
        />
      </LocalizationProvider>
    </SafeAreaProvider>,
  );
  return { start, ...view };
}

test.each(['en', 'fa'] as const)(
  '%s split action defaults to random and offers all three choices',
  (language) => {
    const { start } = show(language);
    const main = () => screen.getByRole('button', { name: translate(language, 'study.start') });
    const dropdown = () =>
      screen.getByRole('button', { name: translate(language, 'study.order.choose') });
    fireEvent.press(main());
    expect(start).toHaveBeenLastCalledWith('random');
    for (const order of ['random', 'in-order', 'reverse'] as const) {
      fireEvent.press(dropdown());
      expect(start).toHaveBeenCalledTimes(order === 'random' ? 1 : order === 'in-order' ? 2 : 3);
      fireEvent.press(
        screen.getByRole('menuitem', { name: translate(language, `study.order.${order}`) }),
      );
      expect(start).toHaveBeenLastCalledWith(order);
      expect(screen.queryByRole('menuitem')).toBeNull();
    }
    fireEvent.press(main());
    expect(start).toHaveBeenLastCalledWith('random');
  },
);

test('dismissing the dropdown does not start a session', () => {
  const { start } = show();
  fireEvent.press(screen.getByRole('button', { name: 'Choose study order' }));
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(start).not.toHaveBeenCalled();
  expect(screen.queryByRole('menuitem')).toBeNull();
});

test('both parts of the split action are disabled while starting', () => {
  const { start } = show('en', true);
  fireEvent.press(screen.getByRole('button', { name: 'Start study' }));
  fireEvent.press(screen.getByRole('button', { name: 'Choose study order' }));
  expect(start).not.toHaveBeenCalled();
  expect(screen.queryByRole('menuitem')).toBeNull();
});
