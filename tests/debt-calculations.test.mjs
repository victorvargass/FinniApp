import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDebtBalanceAdjustmentAmount,
  getNextDebtDueDate,
  isSinglePaymentDebt,
} from '../lib/debt-calculations.ts';

test('a historical payment covered by the balance snapshot does not skip the next due date', () => {
  assert.equal(getNextDebtDueDate('2026-09-25', 'monthly', 0), '2026-09-25');
});

test('a payment after the balance snapshot advances the next due date', () => {
  assert.equal(getNextDebtDueDate('2026-09-25', 'monthly', 1), '2026-10-25');
});

test('a later reported balance does not reset the payment schedule', () => {
  const paymentsSinceRegistration = 1;
  assert.equal(
    getNextDebtDueDate('2026-09-15', 'monthly', paymentsSinceRegistration),
    '2026-10-15'
  );
});

test('reporting the same debt balance still creates a dated synchronization', () => {
  assert.equal(getDebtBalanceAdjustmentAmount(391121, 391121), 0);
});

test('a one-time debt keeps its scheduled date after a partial payment', () => {
  assert.equal(isSinglePaymentDebt(6_131_660, 6_131_660), true);
  assert.equal(getNextDebtDueDate('2026-09-30', null, 1, true), '2026-09-30');
});

test('an installment debt still advances according to its frequency', () => {
  assert.equal(isSinglePaymentDebt(6_131_660, 500_000), false);
  assert.equal(getNextDebtDueDate('2026-09-30', 'monthly', 1, false), '2026-10-30');
});
