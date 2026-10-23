import { fireEvent, render, screen } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { makeCard, makeDeck } from '@/../test/fixtures';
import { languageTag } from '@/core/domain/values';
import {
  formatNumber,
  resolveDirection,
  translate,
  type UiLanguage,
} from '@/shared/localization/localization';
import { useLocalization } from '@/shared/localization/localization-provider';
import { CardForm } from './card-form';

jest.mock('@/core/composition/haptics', () => ({
  haptics: { actionRejected: jest.fn(), actionConfirmed: jest.fn() },
}));

jest.mock('@/features/vocabulary/presentation/vocabulary-helper', () => ({
  VocabularyHelper: () => null,
}));

jest.mock('@/shared/localization/localization-provider', () => ({
  useLocalization: jest.fn(),
}));

function setLanguage(language: UiLanguage) {
  jest.mocked(useLocalization).mockReturnValue({
    language,
    direction: resolveDirection(language),
    t: (key, values) => translate(language, key, values),
    number: (value) => formatNumber(value, language),
  });
}

describe.each([false, true])('card layout when editing is %s', (editing) => {
  test.each(['en-US', 'fa-IR', 'es'])(
    'follows app language changes independently of stored category language %s',
    (tag) => {
      const deck = makeDeck({ language: languageTag(tag), textAlignment: 'rtl' });
      const existing = editing ? makeCard() : undefined;
      const form = () => (
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 400, height: 850 },
            insets: { top: 0, right: 0, bottom: 0, left: 0 },
          }}
        >
          <CardForm deck={deck} existing={existing} onSubmit={jest.fn(async () => {})} />
        </SafeAreaProvider>
      );
      setLanguage('en');
      const { rerender } = render(form());
      for (const key of ['form.frontText', 'form.meaning'] as const) {
        const input = screen.getByLabelText(translate('en', key));
        expect(input.props.value).toBe(
          existing ? (key === 'form.frontText' ? existing.frontText : existing.meaning) : '',
        );
        fireEvent.changeText(input, '');
      }

      for (const language of ['en', 'fa', 'en'] as const) {
        setLanguage(language);
        rerender(form());
        const direction = resolveDirection(language);
        expect(
          screen
            .UNSAFE_getAllByType(TextInput)
            .slice(0, 2)
            .map((input) => input.props.accessibilityLabel),
        ).toEqual([translate(language, 'form.frontText'), translate(language, 'form.meaning')]);
        for (const key of ['form.frontText', 'form.meaning'] as const) {
          expect(screen.getByLabelText(translate(language, key))).toHaveStyle({
            textAlign: direction === 'rtl' ? 'right' : 'left',
            writingDirection: direction,
          });
        }

        for (const [value, writingDirection, textAlign] of [
          ['word', 'ltr', 'left'],
          ['واژه', 'rtl', 'right'],
        ] as const) {
          for (const key of ['form.frontText', 'form.meaning'] as const) {
            const input = screen.getByLabelText(translate(language, key));
            fireEvent.changeText(input, value);
            expect(input.props.value).toBe(value);
            expect(input).toHaveStyle({ textAlign, writingDirection });
            fireEvent.changeText(input, '');
          }
        }
        expect(deck.language).toBe(tag);
      }
    },
  );
});
