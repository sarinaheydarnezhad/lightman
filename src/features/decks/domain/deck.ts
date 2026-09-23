import { requiredText } from '@/core/validation/text';

export interface Deck {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
}

export function validateDeckTitle(title: string): string {
  return requiredText(title, 'Deck title', 120);
}
