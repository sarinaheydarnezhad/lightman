import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { application } from '@/core/composition/application';
import { timestamp } from '@/../test/fixtures';
import { useStartStudy } from './use-start-study';
import { AppError } from '@/core/errors/app-error';
import type { StudySession } from '../domain/study-session';
import { createElement, StrictMode, type PropsWithChildren } from 'react';

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

test('Home, Study and deck hook instances navigate once when concurrent starts resume the same session', async () => {
  const one = renderHook(useStartStudy),
    two = renderHook(useStartStudy),
    three = renderHook(useStartStudy);
  await act(async () => {
    await Promise.all([
      one.result.current.start(scope),
      two.result.current.start(scope),
      three.result.current.start(scope),
    ]);
  });
  expect(application.startStudySession).toHaveBeenCalledTimes(3);
  expect(router.push).toHaveBeenCalledTimes(1);
  await act(() => one.result.current.start(scope));
  expect(router.push).toHaveBeenCalledTimes(2); // A later explicit resume still navigates.
});

test('an incompatible request exposes the existing resume workflow', async () => {
  const active = await application.startStudySession(scope);
  jest
    .mocked(application.startStudySession)
    .mockRejectedValueOnce(new AppError('conflict', 'Finish current session.'));
  jest.mocked(application.getActiveStudySession).mockResolvedValueOnce(active);
  const hook = renderHook(useStartStudy);
  await act(() => hook.result.current.start({ kind: 'all-decks' }));
  expect(hook.result.current.activeSession?.id).toBe('session');
  expect(hook.result.current.error).toBe('study.activeSession');
  expect(router.push).not.toHaveBeenCalled();
});

test('an unmounted entry point does not navigate when its start resolves late', async () => {
  const session = await application.startStudySession(scope);
  let finish!: (session: StudySession) => void;
  jest.mocked(application.startStudySession).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const hook = renderHook(useStartStudy);
  let pending!: Promise<void>;
  act(() => {
    pending = hook.result.current.start(scope);
  });
  hook.unmount();
  await act(async () => {
    finish(session);
    await pending;
  });
  expect(router.push).not.toHaveBeenCalled();
});

test('storage switching during command lookup returns a controlled error and clears the pending guard', async () => {
  const original = Object.getOwnPropertyDescriptor(application, 'startStudySession')!;
  const hook = renderHook(useStartStudy);
  try {
    Object.defineProperty(application, 'startStudySession', {
      configurable: true,
      get: () => {
        throw new AppError('unavailable', 'Storage is switching');
      },
    });
    await act(() => hook.result.current.start(scope));
    expect(hook.result.current.starting).toBe(false);
    expect(hook.result.current.error).toBe('study.startError');
  } finally {
    Object.defineProperty(application, 'startStudySession', original);
  }
  await act(() => hook.result.current.start(scope));
  expect(router.push).toHaveBeenCalledTimes(1);
});

test('a React Strict Mode wrapper keeps a mounted start entry point usable', async () => {
  const hook = renderHook(useStartStudy, {
    wrapper: ({ children }: PropsWithChildren) => createElement(StrictMode, null, children),
  });
  await act(() => hook.result.current.start(scope));
  expect(router.push).toHaveBeenCalledTimes(1);
});
