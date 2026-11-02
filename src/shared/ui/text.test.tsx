import { render, screen } from '@testing-library/react-native';
import { typography, type TypographyVariant } from '@/shared/theme/tokens';
import { Text } from './text';

test('renders accessible text', () => {
  render(<Text>Hello, learner</Text>);
  expect(screen.getByText('Hello, learner')).toBeTruthy();
});

test.each(Object.keys(typography) as TypographyVariant[])('renders the %s variant', (variant) => {
  render(
    <Text variant={variant} tone="secondary">
      {variant}
    </Text>,
  );
  expect(screen.getByText(variant)).toBeTruthy();
});

test('limits lines when truncation is requested', () => {
  render(<Text truncate>Long text</Text>);
  expect(screen.getByText('Long text').props.numberOfLines).toBe(1);
});

test.each([
  ['display', 'Vazirmatn-Bold'],
  ['headingLarge', 'Vazirmatn-Bold'],
  ['headingMedium', 'Vazirmatn-SemiBold'],
  ['headingSmall', 'Vazirmatn-SemiBold'],
  ['bodyLarge', 'Vazirmatn'],
  ['bodyMedium', 'Vazirmatn'],
  ['bodySmall', 'Vazirmatn'],
  ['labelLarge', 'Vazirmatn-SemiBold'],
  ['labelMedium', 'Vazirmatn-SemiBold'],
  ['caption', 'Vazirmatn-Medium'],
] as const)(
  '%s Persian numbers use their bundled font face without requesting another native weight',
  (variant, fontFamily) => {
    render(<Text variant={variant}>۱۲٬۳۴۵</Text>);
    expect(screen.getByText('۱۲٬۳۴۵')).toHaveStyle({ fontFamily, fontWeight: 'normal' });
  },
);

test.each([
  ['regular', 'Vazirmatn'],
  ['medium', 'Vazirmatn-Medium'],
  ['semibold', 'Vazirmatn-SemiBold'],
  ['bold', 'Vazirmatn-Bold'],
] as const)(
  'explicit %s weight selects the bundled face for Persian numbers',
  (weight, fontFamily) => {
    render(
      <Text weight={weight} style={[{ fontSize: 40 }, { lineHeight: 52 }]}>
        ۱۲۳
      </Text>,
    );
    expect(screen.getByText('۱۲۳')).toHaveStyle({
      fontFamily,
      fontWeight: 'normal',
      fontSize: 40,
      lineHeight: 52,
    });
  },
);
