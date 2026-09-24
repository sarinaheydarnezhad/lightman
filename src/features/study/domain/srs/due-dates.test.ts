import { makeState } from '@/../test/fixtures';
import { addCalendarDays, calendarDate } from '@/core/domain/values';
import { getDueReviewStates, isCardDue } from '../leitner-srs';

const today = calendarDate('2026-09-24');

test.each([
  ['2026-09-20', true],
  ['2026-09-24', true],
  ['2026-09-25', false],
] as const)('calendar due date %s is due on September 24: %s', (date, due) => {
  expect(isCardDue(calendarDate(date), today)).toBe(due);
});

test('due queue includes overdue and today, excludes tomorrow and later without mutating inputs', () => {
  const states = Object.freeze([
    Object.freeze(makeState({ cardId: 'tomorrow', dueDate: calendarDate('2026-09-25') })),
    Object.freeze(makeState({ cardId: 'today', dueDate: today })),
    Object.freeze(makeState({ cardId: 'later', dueDate: calendarDate('2026-10-10') })),
    Object.freeze(makeState({ cardId: 'overdue', dueDate: calendarDate('2026-09-20') })),
  ]);
  const snapshot = JSON.stringify(states);
  expect(getDueReviewStates(states, today).map((state) => state.cardId)).toEqual([
    'overdue',
    'today',
  ]);
  expect(JSON.stringify(states)).toBe(snapshot);
  expect(getDueReviewStates(states, calendarDate('2026-09-19'))).toEqual([]);
  expect(getDueReviewStates([], today)).toEqual([]);
});

test('queue ordering is earliest due date, lower box, then stable card ID', () => {
  const states = [
    makeState({ cardId: 'A', box: 4, dueDate: calendarDate('2026-09-20') }),
    makeState({ cardId: 'C', box: 1, dueDate: calendarDate('2026-09-22') }),
    makeState({ cardId: 'B', box: 2, dueDate: calendarDate('2026-09-20') }),
    makeState({ cardId: 'D', box: 2, dueDate: calendarDate('2026-09-20') }),
  ];
  expect(getDueReviewStates(states, today).map((state) => state.cardId)).toEqual([
    'B',
    'D',
    'A',
    'C',
  ]);
});

test.each([
  ['2026-01-31', 1, '2026-02-01'],
  ['2026-02-28', 1, '2026-03-01'],
  ['2028-02-28', 1, '2028-02-29'],
  ['2028-02-29', 1, '2028-03-01'],
  ['2026-12-31', 1, '2027-01-01'],
  ['2027-01-01', 16, '2027-01-17'],
  ['2026-09-24', 7, '2026-10-01'],
  ['2026-01-29', 4, '2026-02-02'],
  ['2028-02-27', 8, '2028-03-06'],
] as const)('calendar date %s plus %i days yields %s', (date, days, expected) => {
  expect(addCalendarDays(calendarDate(date), days)).toBe(expected);
});
