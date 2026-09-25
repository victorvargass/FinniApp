import assert from 'node:assert/strict';
import test from 'node:test';

import { canUpdateExpenseAcrossCreditCycles } from '../lib/credit-cycle-edit.ts';

const reconciledExpense = {
  currentCycleId: 4,
  nextCycleId: 4,
  currentPaymentMethodId: 2,
  nextPaymentMethodId: 2,
  currentOutflow: 2025,
  nextOutflow: 2025,
};

test('a date change inside the same reconciled cycle is allowed', () => {
  assert.equal(canUpdateExpenseAcrossCreditCycles(reconciledExpense), true);
});

test('moving a reconciled expense outside its cycle remains blocked', () => {
  assert.equal(canUpdateExpenseAcrossCreditCycles({
    ...reconciledExpense,
    nextCycleId: null,
  }), false);
});

test('moving a reconciled expense to another cycle remains blocked', () => {
  assert.equal(canUpdateExpenseAcrossCreditCycles({
    ...reconciledExpense,
    nextCycleId: 5,
  }), false);
});

test('changing the charged total in a reconciled cycle remains blocked', () => {
  assert.equal(canUpdateExpenseAcrossCreditCycles({
    ...reconciledExpense,
    nextOutflow: 2500,
  }), false);
});

test('moving an editable expense into a reconciled cycle remains blocked', () => {
  assert.equal(canUpdateExpenseAcrossCreditCycles({
    ...reconciledExpense,
    currentCycleId: null,
  }), false);
});
