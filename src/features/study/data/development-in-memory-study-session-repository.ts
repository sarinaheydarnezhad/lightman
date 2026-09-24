import { requiredId } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import { validateStudySession, type StudySession } from '../domain/study-session';
import type { StudySessionRepository } from '../domain/study-session-repository';

/** Temporary active-workflow adapter; all returned sessions are detached snapshots. */
export class InMemoryStudySessionRepository implements StudySessionRepository {
  private readonly sessions = new Map<string, StudySession>();
  private activeSessionId: string | null = null;

  async create(session: StudySession): Promise<StudySession> {
    const valid = validateStudySession(session);
    if (this.sessions.has(valid.id))
      throw new AppError('conflict', 'Study session already exists.');
    if (valid.status === 'in-progress' && this.activeSessionId)
      throw new AppError('conflict', 'Finish or cancel your current study session first.');
    this.sessions.set(valid.id, valid);
    if (valid.status === 'in-progress') this.activeSessionId = valid.id;
    return validateStudySession(valid);
  }

  async getById(id: string): Promise<StudySession | null> {
    requiredId(id, 'Study session ID');
    const session = this.sessions.get(id);
    return session ? validateStudySession(session) : null;
  }

  async getActive(): Promise<StudySession | null> {
    if (!this.activeSessionId) return null;
    const session = this.sessions.get(this.activeSessionId);
    return session ? validateStudySession(session) : null;
  }

  async update(session: StudySession, expectedCurrentIndex: number): Promise<StudySession> {
    const valid = validateStudySession(session);
    const previous = this.sessions.get(valid.id);
    if (!previous) throw new AppError('not-found', 'Study session not found.');
    if (previous.status !== 'in-progress' || this.activeSessionId !== valid.id)
      throw new AppError('conflict', 'Study session is not active.');
    if (
      previous.currentIndex !== expectedCurrentIndex ||
      valid.currentIndex < previous.currentIndex
    )
      throw new AppError('conflict', 'Study session changed during this answer.');
    if (
      previous.startedAt !== valid.startedAt ||
      JSON.stringify(previous.scope) !== JSON.stringify(valid.scope) ||
      JSON.stringify(previous.initialQueue) !== JSON.stringify(valid.initialQueue)
    )
      throw new AppError('conflict', 'Study session history cannot be changed.');
    if (
      valid.retryQueue.length < previous.retryQueue.length ||
      previous.retryQueue.some(
        (item, index) => JSON.stringify(item) !== JSON.stringify(valid.retryQueue[index]),
      )
    )
      throw new AppError('conflict', 'Study retry history cannot be changed.');
    this.sessions.set(valid.id, valid);
    if (valid.status !== 'in-progress') this.activeSessionId = null;
    return validateStudySession(valid);
  }
}
