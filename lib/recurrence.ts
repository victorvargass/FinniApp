import type { RecurringExpense, RecurringFrequency } from './types';

type RecurrenceRule = Pick<
  RecurringExpense,
  | 'frequency'
  | 'intervalMonths'
  | 'executionDay'
  | 'startDate'
  | 'endDate'
>;

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function addIsoDays(value: string, days: number): string {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function addIsoMonths(value: string, months: number, preferredDay?: number | null): string {
  const date = parseIsoDate(value);
  const targetMonth = date.getMonth() + months;
  const targetYear = date.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  return toIsoDate(new Date(targetYear, normalizedMonth, Math.min(preferredDay ?? date.getDate(), lastDay), 12));
}

function firstCalendarDate(rule: RecurrenceRule): string {
  if (rule.frequency !== 'monthly' && rule.frequency !== 'custom') return rule.startDate;
  const executionDay = rule.executionDay ?? parseIsoDate(rule.startDate).getDate();
  const start = parseIsoDate(rule.startDate);
  const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const sameMonth = toIsoDate(
    new Date(start.getFullYear(), start.getMonth(), Math.min(executionDay, lastDay), 12)
  );
  return sameMonth >= rule.startDate
    ? sameMonth
    : addIsoMonths(sameMonth, rule.frequency === 'custom' ? rule.intervalMonths : 1, executionDay);
}

function nextCalendarDate(rule: RecurrenceRule, current: string): string {
  if (rule.frequency === 'weekly') return addIsoDays(current, 7);
  if (rule.frequency === 'annual') {
    const date = parseIsoDate(current);
    const year = date.getFullYear() + 1;
    const lastDay = new Date(year, date.getMonth() + 1, 0).getDate();
    return toIsoDate(new Date(year, date.getMonth(), Math.min(date.getDate(), lastDay), 12));
  }
  const months = rule.frequency === 'custom' ? Math.max(1, rule.intervalMonths) : 1;
  return addIsoMonths(current, months, rule.executionDay);
}

export function getNextOccurrenceDate(
  rule: RecurrenceRule,
  afterDate: string | null = null
): string | null {
  let candidate: string | null;
  if (afterDate == null) {
    candidate = firstCalendarDate(rule);
  } else {
    candidate = nextCalendarDate(rule, afterDate);
  }
  if (candidate && rule.endDate && candidate > rule.endDate) return null;
  return candidate;
}

export function getOccurrenceDates(
  rule: RecurrenceRule,
  fromDate: string,
  throughDate: string,
  limit = 400
): string[] {
  const dates: string[] = [];
  let current = getNextOccurrenceDate(rule);
  let iterations = 0;
  while (current && current <= throughDate && iterations < limit) {
    if (current >= fromDate) dates.push(current);
    const next = getNextOccurrenceDate(rule, current);
    if (!next || next <= current) break;
    current = next;
    iterations += 1;
  }
  return dates;
}

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  annual: 'Anual',
  custom: 'Personalizado',
};

export function describeRecurrence(rule: RecurrenceRule): string {
  if (rule.frequency === 'custom') {
    return `Cada ${rule.intervalMonths} ${rule.intervalMonths === 1 ? 'mes' : 'meses'}`;
  }
  if (rule.frequency === 'monthly') {
    return `Mensual · día ${rule.executionDay ?? parseIsoDate(rule.startDate).getDate()}`;
  }
  return FREQUENCY_LABELS[rule.frequency];
}
