import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  getForecastMonthEnd,
  groupFinancialForecastItems,
  summarizeFinancialForecast,
} from '../lib/financial-forecast.ts';

test('forecast separates expected income from every future outflow', () => {
  const summary = summarizeFinancialForecast([
    { id: 'i', kind: 'income', name: 'Sueldo', amount: 500000, date: '2026-10-01' },
    { id: 'e', kind: 'expense', name: 'Cuenta', amount: 30000, date: '2026-10-02' },
    { id: 'd', kind: 'debt', name: 'Préstamo', amount: 50000, date: '2026-10-03' },
    { id: 'c', kind: 'installment', name: 'Compra', amount: 20000, date: '2026-10-04' },
    { id: 'r', kind: 'receivable', name: 'Cobro', amount: 40000, date: '2026-10-04' },
    { id: 'b', kind: 'billed', name: 'Tarjeta', amount: 15000, date: '2026-10-05' },
  ]);
  assert.deepEqual(summary, { projectedIncome: 540000, projectedOutflow: 115000, projectedNet: 425000 });
});

test('forecast uses the calendar month end instead of the selected period end', () => {
  assert.equal(getForecastMonthEnd('2026-10-02'), '2026-10-31');
  assert.equal(getForecastMonthEnd('2028-02-10'), '2028-02-29');
});

test('forecast groups overdue, next seven days, and later movements', () => {
  const items = [
    { id: 'overdue', kind: 'debt', name: 'A', amount: 1, date: '2026-10-01' },
    { id: 'today', kind: 'income', name: 'B', amount: 1, date: '2026-10-02' },
    { id: 'edge', kind: 'expense', name: 'C', amount: 1, date: '2026-10-09' },
    { id: 'later', kind: 'billed', name: 'D', amount: 1, date: '2026-10-10' },
  ];
  const groups = groupFinancialForecastItems(items, '2026-10-02');
  assert.deepEqual(groups.overdue.map((item) => item.id), ['overdue']);
  assert.deepEqual(groups.soon.map((item) => item.id), ['today', 'edge']);
  assert.deepEqual(groups.later.map((item) => item.id), ['later']);
});

test('forecast projects recurrence rules and excludes registered occurrences', () => {
  const source = readFileSync(new URL('../lib/database/forecast.ts', import.meta.url), 'utf8');
  assert.match(source, /getOccurrenceDates/);
  assert.match(source, /statuses\.get\(scheduledDate\) === 'generated'/);
  assert.match(source, /statuses\.get\(scheduledDate\) === 'skipped'/);
  assert.match(source, /installment\.status = 'projected'/);
  assert.match(source, /getPaymentMethods\(true\)/);
  assert.match(source, /method\.billedAmount > 0/);
  assert.match(source, /debt\.direction === 'receivable'/);
});
