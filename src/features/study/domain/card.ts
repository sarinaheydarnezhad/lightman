import { MAX_CARD_TEXT_LENGTH } from '@/core/constants';
import { instant, requiredId, type Instant } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';

export const MAX_CARD_EXAMPLES = 20;
export const MAX_CARD_PAYLOAD_BYTES =
  6 * (2 * MAX_CARD_TEXT_LENGTH + 500 + 120 + MAX_CARD_EXAMPLES * 3 * MAX_CARD_TEXT_LENGTH) + 2048;
export const MAX_SYNC_PUSH_BYTES = 2 * 1024 * 1024;

/** UTF-8 without depending on TextEncoder in native runtimes. */
export function utf8Bytes(value: string): number {
  let size = 0;
  for (const point of value) {
    const code = point.codePointAt(0)!;
    size += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return size;
}

function wellFormedText(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

function cardText(value: unknown, field: string, maximum: number, required: boolean): string {
  if (
    typeof value !== 'string' ||
    value.length > maximum ||
    !wellFormedText(value)
  )
    throw new AppError(
      'validation',
      `${field} must be valid text of at most ${maximum} UTF-16 units.`,
    );
  const normalized = value.trim();
  if (required && !normalized) throw new AppError('validation', `${field} is required.`);
  return normalized;
}

export interface CardExample {
  readonly sentence: string;
  readonly translation?: string;
  readonly notes?: string;
}

export interface Card {
  readonly id: string;
  readonly deckId: string;
  readonly frontText: string;
  readonly phonetic: string | null;
  readonly category: string | null;
  readonly meaning: string;
  readonly examples: readonly CardExample[];
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly archivedAt: Instant | null;
}

export function validateCardText(value: string, side: 'front' | 'back'): string {
  return cardText(value, `Card ${side}`, MAX_CARD_TEXT_LENGTH, true);
}

/** Shared field validation for the form and complete entity validation. */
export function validateCardContent(
  content: Pick<Card, 'frontText' | 'meaning' | 'phonetic' | 'category' | 'examples'>,
) {
  if (!content || typeof content !== 'object' || Array.isArray(content))
    throw new AppError('validation', 'Invalid card content.');
  const frontText = validateCardText(content.frontText, 'front');
  const meaning = validateCardText(content.meaning, 'back');
  const { phonetic, category } = content;
  const normalizedPhonetic =
    phonetic == null ? null : cardText(phonetic, 'Phonetic text', 500, false) || null;
  const normalizedCategory =
    category == null ? null : cardText(category, 'Category', 120, false) || null;
  if (!Array.isArray(content.examples) || content.examples.length > MAX_CARD_EXAMPLES)
    throw new AppError('validation', 'Invalid card examples.');
  const examples = Array.from(content.examples, (example: unknown, index): CardExample => {
    if (
      !example ||
      typeof example !== 'object' ||
      Array.isArray(example) ||
      Object.keys(example).some((key) => !['sentence', 'translation', 'notes'].includes(key))
    )
      throw new AppError('validation', `Invalid card example at examples[${index}].`);
    const fields = example as Record<string, unknown>;
    const optional = (key: 'translation' | 'notes') =>
      fields[key] === undefined
        ? ''
        : cardText(fields[key], `examples[${index}].${key}`, MAX_CARD_TEXT_LENGTH, false);
    const translation = optional('translation');
    const notes = optional('notes');
    return {
      sentence: cardText(
        fields.sentence,
        `examples[${index}].sentence`,
        MAX_CARD_TEXT_LENGTH,
        true,
      ),
      ...(translation ? { translation } : {}),
      ...(notes ? { notes } : {}),
    };
  });
  return {
    frontText,
    meaning,
    phonetic: normalizedPhonetic,
    category: normalizedCategory,
    examples,
  };
}

export function validateCard(card: Card): Card {
  if (
    !card ||
    typeof card !== 'object' ||
    typeof card.id !== 'string' ||
    typeof card.deckId !== 'string'
  )
    throw new AppError('validation', 'Invalid card identity.');
  requiredId(card.id, 'Card ID');
  requiredId(card.deckId, 'Deck ID');
  const content = validateCardContent(card);
  instant(card.createdAt);
  instant(card.updatedAt);
  if (card.updatedAt < card.createdAt)
    throw new AppError('validation', 'Card dates are out of order.');
  if (card.archivedAt !== null) {
    instant(card.archivedAt);
    if (card.archivedAt < card.createdAt)
      throw new AppError('validation', 'Deletion date is out of order.');
  }
  return {
    ...card,
    ...content,
  };
}
