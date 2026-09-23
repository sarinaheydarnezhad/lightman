import { AppError } from '@/core/errors/app-error';
import { validateDeckTitle } from './deck';

test('trims a valid title and rejects blank titles', () => {
  expect(validateDeckTitle('  Languages  ')).toBe('Languages');
  expect(() => validateDeckTitle('  ')).toThrow(AppError);
});
