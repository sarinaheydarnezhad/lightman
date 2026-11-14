import { execFileSync } from 'node:child_process';
import { localTime } from '@/core/domain/values';
import { reminderDates } from './reminder-calendar';

function inZone(zone: string, now: string, time: string, days = 30) {
  // A new process is required: changing TZ inside Jest does not change its Date realm.
  const script = `const fs=require('fs'),ts=require('typescript');
    const source=ts.transpileModule(fs.readFileSync('src/core/application/reminder-calendar.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
    const m={exports:{}};new Function('exports',source)(m.exports);
    console.log(JSON.stringify(m.exports.reminderDates(new Date(${JSON.stringify(now)}),${JSON.stringify(time)},${days}).map(d=>({utc:d.toISOString(),local:[d.getFullYear(),d.getMonth()+1,d.getDate(),d.getHours(),d.getMinutes()]}))));`;
  return JSON.parse(
    execFileSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      env: { ...process.env, TZ: zone },
      windowsHide: true,
    }).toString(),
  ) as { utc: string; local: number[] }[];
}

test('spring-forward normalizes only the missing minute and preserves the selected time on later days', () => {
  const dates = inZone('America/New_York', '2026-03-08T05:00:00.000Z', '02:30');
  expect(dates[0]?.local).toEqual([2026, 3, 8, 3, 30]);
  expect(dates[1]?.local).toEqual([2026, 3, 9, 2, 30]);
  expect(dates.slice(1).every((d) => d.local[3] === 2 && d.local[4] === 30)).toBe(true);
});

test('fall-back chooses one occurrence and does not schedule the repeated minute twice', () => {
  const dates = inZone('America/New_York', '2026-11-01T04:00:00.000Z', '01:30');
  expect(dates[0]?.utc).toBe('2026-11-01T05:30:00.000Z');
  expect(dates[1]?.utc).toBe('2026-11-02T06:30:00.000Z');
  expect(new Set(dates.map((d) => d.local.slice(0, 3).join('-'))).size).toBe(30);
});

test.each(['UTC', 'Asia/Tehran', 'America/New_York', 'Pacific/Auckland'])(
  '30-day window is bounded, future and unique in %s',
  (zone) => {
    const now = '2026-12-31T22:00:00.000Z';
    const dates = inZone(zone, now, '00:05');
    expect(dates).toHaveLength(30);
    expect(dates.every((d) => d.utc > now)).toBe(true);
    expect(dates.every((d) => d.local[3] === 0 && d.local[4] === 5)).toBe(true);
    expect(new Set(dates.map((d) => d.utc)).size).toBe(30);
  },
);

test('exact boundary advances to tomorrow; restart after inactivity replenishes a fresh window', () => {
  const first = reminderDates(new Date(2026, 0, 1, 9), localTime('09:00'), 30);
  expect(first[0]).toEqual(new Date(2026, 0, 2, 9));
  const restarted = reminderDates(new Date(2026, 2, 1, 8), localTime('09:00'), 30);
  expect(restarted[0]).toEqual(new Date(2026, 2, 1, 9));
  expect(first.every((d) => d < restarted[0]!)).toBe(true);
});

test('timezone refresh retains local HH:mm while recalculating absolute dates', () => {
  const now = '2026-11-14T00:00:00.000Z';
  const tehran = inZone('Asia/Tehran', now, '09:00');
  const newYork = inZone('America/New_York', now, '09:00');
  expect(tehran[0]?.local.slice(3)).toEqual([9, 0]);
  expect(newYork[0]?.local.slice(3)).toEqual([9, 0]);
  expect(tehran[0]?.utc).not.toBe(newYork[0]?.utc);
});
