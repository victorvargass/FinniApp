import assert from 'node:assert/strict';
import test from 'node:test';

import {
  visibleHomeDebtPlans,
  visibleHomeDebts,
  visibleHomePaymentMethods,
  visibleHomeSavingsActivity,
} from '../lib/home-visibility.ts';

test('home visibility filters each configurable financial item', () => {
  const methods = [
    { id: 1, showOnHome: true },
    { id: 2, showOnHome: false },
  ];
  const goals = [
    { id: 10, showOnHome: true },
    { id: 11, showOnHome: false },
  ];

  assert.deepEqual(visibleHomePaymentMethods(methods).map((item) => item.id), [1]);
  assert.deepEqual(visibleHomeDebts([
    { id: 20, showOnHome: true },
    { id: 21, showOnHome: false },
  ]).map((item) => item.id), [20]);
  assert.deepEqual(visibleHomeSavingsActivity([
    { goalId: 10 },
    { goalId: 11 },
  ], goals).map((item) => item.goalId), [10]);
  assert.deepEqual(visibleHomeDebtPlans([
    { id: 30, paymentMethodId: 1, showOnHome: true },
    { id: 31, paymentMethodId: 2, showOnHome: true },
    { id: 32, paymentMethodId: 1, showOnHome: false },
  ], methods).map((item) => item.id), [30]);
});

test('legacy in-memory items remain visible when the preference is absent', () => {
  assert.equal(visibleHomePaymentMethods([{ id: 1 }]).length, 1);
  assert.equal(visibleHomeDebts([{ id: 2 }]).length, 1);
});
