import { instant, requiredId, type Instant } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';

export interface StudySession {
  readonly id: string;
  readonly deckId: string;
  readonly startedAt: Instant;
  readonly completedAt: Instant | null;
  readonly cardIds: readonly string[];
  readonly currentIndex: number;
}

export function validateStudySession(session: StudySession): StudySession {
  requiredId(session.id, 'Study session ID');
  requiredId(session.deckId, 'Deck ID');
  instant(session.startedAt);
  if (session.completedAt !== null) {
    instant(session.completedAt);
    if (session.completedAt < session.startedAt)
      throw new AppError('validation', 'Session dates are out of order.');
  }
  session.cardIds.forEach((id) => requiredId(id, 'Card ID'));
  if (
    !Number.isInteger(session.currentIndex) ||
    session.currentIndex < 0 ||
    session.currentIndex > session.cardIds.length
  ) {
    throw new AppError('validation', 'Invalid study position.');
  }
  return { ...session, cardIds: [...session.cardIds] };
}
