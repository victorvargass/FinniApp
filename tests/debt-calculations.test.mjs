import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canOmitDebtDueDate,
  getDebtBalanceAdjustmentAmount,
  getDebtScheduleStartDate,
  getNextDebtDueDate,
  isSinglePaymentDebt,
} from '../lib/debt-calculations.ts';

test('only a one-time receivable can omit its estimated due date', () => {
  assert.equal(canOmitDebtDueDate('receivable', true), true);
  assert.equal(canOmitDebtDueDate('receivable', false), false);
  assert.equal(canOmitDebtDueDate('payable', true), false);
});

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

test('editing a next estimated date preserves the underlying payment schedule', () => {
  const scheduleStart = getDebtScheduleStartDate('2026-10-15', 'monthly', 1);
  assert.equal(scheduleStart, '2026-09-15');
  assert.equal(getNextDebtDueDate(scheduleStart, 'monthly', 1), '2026-10-15');
});
