import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';

import { application } from '@/core/composition/application';
import { AppError } from '@/core/errors/app-error';
import type { StudyScope, StudySession } from '../domain/study-session';

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

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const start = useCallback(async (scope: StudyScope, replace = false) => {
    if (pending.current) return;
    pending.current = true;
    setStarting(true);
    setError(null);
    setActiveSession(null);
    try {
      openStudySession(await application.startStudySession(scope), replace);
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
      pending.current = false;
      if (mounted.current) setStarting(false);
    }
  }, []);

  return { start, starting, error, activeSession, clearError: () => setError(null) };
}
