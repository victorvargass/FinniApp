export const DEFAULT_EVENT_TIME = '12:00';

export function toTimeString(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

export function isValidTimeString(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function resolveEventTime(value: string | null | undefined, fallback = new Date()): string {
  return isValidTimeString(value) ? value : toTimeString(fallback);
}

export function dateWithTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

