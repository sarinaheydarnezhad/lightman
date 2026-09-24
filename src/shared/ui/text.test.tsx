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
