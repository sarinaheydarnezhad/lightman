import type { StudySession } from './study-session';

/** Active workflow state. A different adapter can replace the in-memory implementation. */
export interface StudySessionRepository {
  create(session: StudySession): Promise<StudySession>;
  getById(id: string): Promise<StudySession | null>;
  getActive(): Promise<StudySession | null>;
  update(session: StudySession, expectedCurrentIndex: number): Promise<StudySession>;
}
