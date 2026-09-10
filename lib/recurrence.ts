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

function frequencyLabel(frequency: RecurringFrequency): string {
  const keys: Record<RecurringFrequency, Parameters<typeof t>[0]> = {
    weekly: 'recurrence.weekly',
    monthly: 'recurrence.monthly',
    annual: 'recurrence.annual',
    custom: 'recurrence.custom',
  };
  return t(keys[frequency]);
}

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
  return frequencyLabel(rule.frequency);
}
