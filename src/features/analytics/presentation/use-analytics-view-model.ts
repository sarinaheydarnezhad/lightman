import { useCallback, useState } from 'react';

import { application } from '@/core/composition/application';
import type { AnalyticsWindow } from '../domain/analytics';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';

/** Focus refresh picks up newly recorded reviews without mirroring history in UI state. */
export function useAnalyticsViewModel() {
  const [window, setWindow] = useState<AnalyticsWindow>(30);
  const resource = useFocusedResource(
    useCallback(() => application.getAnalyticsWindow(window), [window]),
  );
  return { ...resource, window, setWindow };
}
