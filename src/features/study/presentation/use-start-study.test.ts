import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { application } from '@/core/composition/application';
import { timestamp } from '@/../test/fixtures';
import { useStartStudy } from './use-start-study';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@/core/composition/application', () => ({
  application: {
    startStudySession: jest.fn(),
    getActiveStudySession: jest.fn(),
  },
}));

const scope = { kind: 'specific-deck' as const, deckId: 'deck-1' };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(application.startStudySession).mockResolvedValue({
    id: 'session',
    scope,
    status: 'completed',
    startedAt: timestamp,
    completedAt: timestamp,
    cancelledAt: null,
    initialQueue: [],
    retryQueue: [],
    currentIndex: 0,
    retrySuccesses: 0,
  });
});

test.each(['random', 'in-order', 'reverse'] as const)(
  '%s reaches the study service and opens its saved session',
  async (order) => {
    const { result } = renderHook(useStartStudy);
    await act(() => result.current.start(scope, false, order));
    expect(application.startStudySession).toHaveBeenCalledWith(scope, order);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/study/[sessionId]',
      params: { sessionId: 'session' },
    });
  },
);

test('the main action stays random after choosing another order and repeat-study can replace navigation', async () => {
  const { result } = renderHook(useStartStudy);
  await act(() => result.current.start(scope, true, 'reverse'));
  expect(router.replace).toHaveBeenCalled();
  await act(() => result.current.start(scope));
  expect(application.startStudySession).toHaveBeenLastCalledWith(scope, 'random');
});
