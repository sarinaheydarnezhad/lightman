import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';

import { application } from '@/core/composition/application';
import { AppError } from '@/core/errors/app-error';
import type { StudyScope, StudySession } from '../domain/study-session';
import type { StudyOrder } from '../domain/study-order';

// Only overlapping requests share navigation ownership. Later explicit resumes still navigate.
const starts = new WeakMap<object, { pending: number; opened: Set<string> }>();

export function openStudySession(session: StudySession, replace = false) {
  const destination = {
    pathname: '/study/[sessionId]' as const,
    params: { sessionId: session.id },
  };
  if (replace) router.replace(destination);
  else router.push(destination);
}

/** Shared entry point for Home, the Study tab and deck details. */
export function useStartStudy() {
  const pending = useRef(false);
  const mounted = useRef(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const start = useCallback(
    async (scope: StudyScope, replace = false, order: StudyOrder = 'random') => {
      if (pending.current) return;
      pending.current = true;
      setStarting(true);
      setError(null);
      setActiveSession(null);
      let startSession: typeof application.startStudySession | undefined;
      let group: { pending: number; opened: Set<string> } | undefined;
      try {
        startSession = application.startStudySession;
        group = starts.get(startSession);
        if (!group) {
          group = { pending: 0, opened: new Set() };
          starts.set(startSession, group);
        }
        group.pending++;
        const session = await startSession(scope, order);
        if (mounted.current && !group.opened.has(session.id)) {
          group.opened.add(session.id);
          openStudySession(session, replace);
        }
      } catch (cause) {
        if (cause instanceof AppError && cause.code === 'conflict') {
          try {
            const active = await application.getActiveStudySession();
            if (mounted.current && active) {
              setActiveSession(active);
              setError('Finish or leave your current session before starting another.');
              return;
            }
          } catch {
            // Show the original safe error when the active session cannot be loaded.
          }
        }
        if (mounted.current) {
          setError(
            cause instanceof AppError ? cause.message : 'Unable to start studying. Try again.',
          );
        }
      } finally {
        if (group && startSession && --group.pending === 0) starts.delete(startSession);
        pending.current = false;
        if (mounted.current) setStarting(false);
      }
    },
    [],
  );

  return { start, starting, error, activeSession, clearError: () => setError(null) };
}
