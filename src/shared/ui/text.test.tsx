import { render, screen } from '@testing-library/react-native';
import { Text } from './text';

test('renders accessible text', () => {
  render(<Text>Hello, learner</Text>);
  expect(screen.getByText('Hello, learner')).toBeTruthy();
});
