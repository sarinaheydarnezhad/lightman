/** Optional presentation feedback; callers never use this to decide whether an action succeeded. */
export type HapticEvent =
  | 'selection'
  | 'cardReveal'
  | 'answerSuccess'
  | 'answerFailure'
  | 'swipeCommit'
  | 'actionConfirmed'
  | 'actionRejected';

export interface HapticFeedbackService {
  selection(): Promise<void>;
  cardReveal(): Promise<void>;
  answerSuccess(): Promise<void>;
  answerFailure(): Promise<void>;
  swipeCommit(): Promise<void>;
  actionConfirmed(): Promise<void>;
  actionRejected(): Promise<void>;
}
