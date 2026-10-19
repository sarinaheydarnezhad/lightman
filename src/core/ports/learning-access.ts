export type LearningOperation = 'deck' | 'card' | 'study';

export interface LearningAccess {
  assertAllowed(operation: LearningOperation, amount?: number): Promise<void>;
}
