import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { summarizeFinancialForecast } from '../lib/financial-forecast.ts';

test('forecast separates expected income from every future outflow', () => {
  const summary = summarizeFinancialForecast([
    { id: 'i', kind: 'income', name: 'Sueldo', amount: 500000, date: '2026-10-01' },
    { id: 'e', kind: 'expense', name: 'Cuenta', amount: 30000, date: '2026-10-02' },
    { id: 'd', kind: 'debt', name: 'Préstamo', amount: 50000, date: '2026-10-03' },
    { id: 'c', kind: 'installment', name: 'Compra', amount: 20000, date: '2026-10-04' },
  ]);
  assert.deepEqual(summary, { projectedIncome: 500000, projectedOutflow: 100000, projectedNet: 400000 });
});

test('forecast query only projects unregistered future commitments', () => {
  const source = readFileSync(new URL('../lib/database/forecast.ts', import.meta.url), 'utf8');
  assert.match(source, /occurrence\.status IN \('scheduled', 'pending'\)/);
  assert.match(source, /installment\.status = 'projected'/);
  assert.match(source, /occurrence\.scheduled_date > \?/);
  assert.match(source, /recurring_incomes[\s\S]*?UNION ALL\s+SELECT 'installment-'/);
  assert.doesNotMatch(source, /occurrence\.status[^\n]*generated/);
});
