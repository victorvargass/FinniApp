import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateAvailableBalance,
  getEstimatedPaymentDueDate,
} from '../lib/payment-method-calculations.ts';

test('available balance applies charges and card payments after the snapshot', () => {
  assert.equal(calculateAvailableBalance(1_000_000, 250_000, 80_000), 830_000);
  assert.equal(calculateAvailableBalance(50_000, 80_000, 0), 0);
});

test('due date uses the next valid occurrence of the configured day', () => {
  assert.equal(getEstimatedPaymentDueDate('2026-09-18', 5).toISOString().slice(0, 10), '2026-10-05');
  assert.equal(getEstimatedPaymentDueDate('2026-09-18', 25).toISOString().slice(0, 10), '2026-09-25');
  assert.equal(getEstimatedPaymentDueDate('2026-01-31', 31).toISOString().slice(0, 10), '2026-02-28');
});
