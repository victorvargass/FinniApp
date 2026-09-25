import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getRecurringExpensesForSection,
  isRecurringSavingsContribution,
} from '../lib/recurring-sections.ts';

const recurringExpense = {
  id: 1,
  savingsGoalId: null,
  savingsKind: null,
};

const recurringSavings = {
  id: 2,
  savingsGoalId: 8,
  savingsKind: 'contribution',
};

test('a recurring contribution is classified as savings', () => {
  assert.equal(isRecurringSavingsContribution(recurringSavings), true);
  assert.equal(isRecurringSavingsContribution(recurringExpense), false);
});

test('recurring savings and ordinary expenses appear in separate sections', () => {
  const items = [recurringExpense, recurringSavings];

  assert.deepEqual(
    getRecurringExpensesForSection(items, 'expenses').map((item) => item.id),
    [1]
  );
  assert.deepEqual(
    getRecurringExpensesForSection(items, 'savings').map((item) => item.id),
    [2]
  );
});
