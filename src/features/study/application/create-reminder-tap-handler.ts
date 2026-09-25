import type { Application } from '@/core/application/create-application';
import type { StudySession } from '../domain/study-session';

/** A tap enters the current all-decks flow; no review decision comes from the alert. */
export function createReminderTapHandler(
  study: Pick<Application, 'getActiveStudySession' | 'startStudySession'>,
  openSession: (session: StudySession) => void,
  openStudy: () => void,
) {
  let pending = false;
  return async () => {
    if (pending) return;
    pending = true;
    try {
      const active = await study.getActiveStudySession();
      const session = active ?? (await study.startStudySession({ kind: 'all-decks' }));
      openSession(session);
    } catch {
      openStudy();
    } finally {
      pending = false;
    }
  };
}
