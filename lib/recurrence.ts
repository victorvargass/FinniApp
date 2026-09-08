import type { RecurringExpense, RecurringFrequency } from './types';
import { t } from './i18n';
import {
  addIsoDays,
  addIsoMonths,
  getNextOccurrenceDate,
  getOccurrenceDates,
  parseIsoDate,
  toIsoDate,
} from './recurrence-core';

export {
  addIsoDays,
  addIsoMonths,
  getNextOccurrenceDate,
  getOccurrenceDates,
  parseIsoDate,
  toIsoDate,
} from './recurrence-core';

type RecurrenceRule = Pick<
  RecurringExpense,
  | 'frequency'
  | 'intervalMonths'
  | 'executionDay'
  | 'startDate'
  | 'endDate'
>;

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: t('recurrence.weekly'),
  monthly: t('recurrence.monthly'),
  annual: t('recurrence.annual'),
  custom: t('recurrence.custom'),
};

export function describeRecurrence(rule: RecurrenceRule): string {
  if (rule.frequency === 'custom') {
    return rule.intervalMonths === 1
      ? t('recurrence.everyMonth')
      : t('recurrence.everyMonths', { count: rule.intervalMonths });
  }
  if (rule.frequency === 'monthly') {
    return t('recurrence.monthlyDay', {
      day: rule.executionDay ?? parseIsoDate(rule.startDate).getDate(),
    });
  }
  return FREQUENCY_LABELS[rule.frequency];
}
