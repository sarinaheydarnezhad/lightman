import { MAX_CARD_TEXT_LENGTH } from '@/core/constants';
import { requiredText } from '@/core/validation/text';

export interface Card {
  readonly id: string;
  readonly deckId: string;
  readonly front: string;
  readonly back: string;
}

export function validateCardText(value: string, side: 'front' | 'back'): string {
  return requiredText(value, `Card ${side}`, MAX_CARD_TEXT_LENGTH);
}
