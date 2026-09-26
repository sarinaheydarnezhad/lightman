import { AppError } from '@/core/errors/app-error';

import { summarizeErrorForLogging } from './platform';

test('summarizes errors without exposing messages, causes, or stack traces', () => {
  expect(summarizeErrorForLogging(new AppError('persistence', 'SQL leaked'))).toEqual({
    name: 'AppError',
    code: 'persistence',
  });
  expect(summarizeErrorForLogging(new Error('private path'))).toEqual({ name: 'Error' });
  expect(summarizeErrorForLogging({ token: 'secret' })).toEqual({ type: 'object' });
  expect(summarizeErrorForLogging(undefined)).toBeUndefined();
});
