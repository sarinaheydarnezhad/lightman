import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppError, type AppErrorCode } from '@/core/errors/app-error';

/** Reload after navigation returns to a screen; stale asynchronous results are ignored. */
export function useFocusedResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AppErrorCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.resolve()
        .then(() => {
          if (!active) return;
          setLoading(true);
          setError(null);
          setErrorCode(null);
          return load();
        })
        .then((value) => {
          if (active && value !== undefined) setData(value);
        })
        .catch((cause: unknown) => {
          if (active) {
            setData(null);
            setError(cause instanceof AppError ? cause.message : 'Unable to load this screen.');
            setErrorCode(cause instanceof AppError ? cause.code : null);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
      // version is an explicit reload signal after a write or retry.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, version]),
  );

  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  return { data, error, errorCode, loading, refresh };
}
