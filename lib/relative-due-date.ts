const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function localCalendarDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getLocalCalendarDaysUntil(date: Date, now: Date): number {
  return Math.round((localCalendarDay(date) - localCalendarDay(now)) / MILLISECONDS_PER_DAY);
}
