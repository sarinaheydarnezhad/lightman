import type { LocalTime } from '@/core/domain/values';

/** One future occurrence per device-local calendar day; nonexistent minutes move forward. */
export function reminderDates(current: Date, time: LocalTime, days: number): Date[] {
  const [hour, minute] = time.split(':').map(Number);
  const onDay = (offset: number) =>
    new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() + offset,
      hour!,
      minute!,
      0,
      0,
    );
  const firstDay = onDay(0) <= current ? 1 : 0;
  // Reapply HH:mm independently each day. Reusing a DST-normalized first time
  // would otherwise shift the entire plan after a spring-forward gap.
  return Array.from({ length: days }, (_value, offset) => onDay(firstDay + offset));
}
