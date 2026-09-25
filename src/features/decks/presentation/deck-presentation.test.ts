import { languageTag, instant } from '@/core/domain/values';
import { makeDeck } from '@/../test/fixtures';
import {
  cardCountLabel,
  deckAlignment,
  deckBadgeAlignment,
  deckTypography,
  languageLabel,
  sortDecks,
} from './deck-presentation';

test('deck presentation reads language tags, truthful counts and semantic display settings', () => {
  expect(languageLabel(languageTag('fa-IR'))).toBe('Persian');
  expect(languageLabel(languageTag('ar'))).toBe('Arabic');
  expect(languageLabel(languageTag('es'))).toBe('Other (es)');
  expect(cardCountLabel(0)).toBe('No cards yet');
  expect(cardCountLabel(1)).toBe('1 card');
  expect(cardCountLabel(2)).toBe('2 cards');
  expect(deckAlignment.rtl).toBe('right');
  expect(deckBadgeAlignment.rtl).toBe('flex-end');
  expect(deckTypography.large).toBe('bodyLarge');
});

test('list sorting uses current domain timestamps or alphabetical names without mutating input', () => {
  const earlier = makeDeck({ id: 'earlier', name: 'Alpha' });
  const later = makeDeck({
    id: 'later',
    name: 'Zulu',
    updatedAt: instant('2026-09-24T11:00:00.000Z'),
  });
  const source = [earlier, later];
  expect(sortDecks(source, 'recently-updated').map((deck) => deck.id)).toEqual([
    'later',
    'earlier',
  ]);
  expect(sortDecks(source, 'alphabetical').map((deck) => deck.id)).toEqual(['earlier', 'later']);
  expect(source[0]).toBe(earlier);
});
