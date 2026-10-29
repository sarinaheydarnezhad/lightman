import { AppError } from '@/core/errors/app-error';
import type { StudyQueueItem } from './study-session';

export type StudyOrder = 'random' | 'in-order' | 'reverse';

export function orderStudyQueue(
  queue: readonly StudyQueueItem[],
  order: StudyOrder,
  random: () => number,
): StudyQueueItem[] {
  if (!['random', 'in-order', 'reverse'].includes(order))
    throw new AppError('validation', 'Invalid study order.');
  const ordered = [...queue];
  if (order === 'reverse') return ordered.reverse();
  if (order === 'random') {
    for (let index = ordered.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [ordered[index], ordered[other]] = [ordered[other]!, ordered[index]!];
    }
  }
  return ordered;
}
