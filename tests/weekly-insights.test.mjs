import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWeeklyInsight, findSavingsMilestone } from '../lib/weekly-insights.ts';

const expense = (date, amount, categoryName) => ({ date, amount, categoryName });

test('weekly insight compares the last seven days with the previous seven', () => {
  const insight = buildWeeklyInsight(
    [
      expense('2026-09-11', 30000, 'Alimentación'),
      expense('2026-09-08', 20000, 'Transporte'),
      expense('2026-09-03', 100000, 'Alimentación'),
    ],
    [{ date: '2026-09-10', amount: 200000 }],
    '2026-09-11'
  );

  assert.equal(insight.expenseTotal, 50000);
  assert.equal(insight.incomeTotal, 200000);
  assert.equal(insight.previousExpenseTotal, 100000);
  assert.equal(insight.expenseChangePercent, -50);
  assert.equal(insight.topCategoryName, 'Alimentación');
});

test('savings milestone reports the highest useful threshold', () => {
  const milestone = findSavingsMilestone([
    { goalName: 'Viaje', targetAmount: 1000000, closingAmount: 510000 },
    { goalName: 'Emergencia', targetAmount: 1000000, closingAmount: 260000 },
  ]);

  assert.deepEqual(milestone && { name: milestone.name, milestone: milestone.milestone }, {
    name: 'Viaje',
    milestone: 50,
  });
});
