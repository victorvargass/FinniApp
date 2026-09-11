import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateAvailableBalance,
  findUrgentCardPayment,
  getEstimatedPaymentDueDate,
} from '../lib/payment-method-calculations.ts';

test('available balance applies charges and card payments after the snapshot', () => {
  assert.equal(calculateAvailableBalance(1_000_000, 250_000, 80_000), 830_000);
  assert.equal(calculateAvailableBalance(50_000, 80_000, 0), -30_000);
});

test('installment purchases consume their full total only once', () => {
  assert.equal(calculateAvailableBalance(1_000_000, 0, 0, 600_000), 400_000);
  assert.equal(calculateAvailableBalance(1_000_000, 100_000, 80_000, 600_000), 380_000);
});

test('due date uses the next valid occurrence of the configured day', () => {
  assert.equal(getEstimatedPaymentDueDate('2026-09-18', 5).toISOString().slice(0, 10), '2026-10-05');
  assert.equal(getEstimatedPaymentDueDate('2026-09-18', 25).toISOString().slice(0, 10), '2026-09-25');
  assert.equal(getEstimatedPaymentDueDate('2026-01-31', 31).toISOString().slice(0, 10), '2026-02-28');
});

test('urgent card payment selects the closest billed credit card', () => {
  const base = {
    active: true,
    type: 'credit',
    paymentDueDay: 15,
    billedAmount: 120_000,
    statementDate: '2026-09-01',
  };
  const urgent = findUrgentCardPayment([
    { ...base, id: 1, name: 'Card A' },
    { ...base, id: 2, name: 'Card B', paymentDueDay: 12 },
  ], new Date(2026, 8, 10));

  assert.equal(urgent?.method.name, 'Card B');
  assert.equal(urgent?.daysUntil, 2);
});

test('card payment outside the next week is not urgent', () => {
  const urgent = findUrgentCardPayment([{
    active: true,
    type: 'credit',
    paymentDueDay: 25,
    billedAmount: 120_000,
    statementDate: '2026-09-01',
  }], new Date(2026, 8, 10));

  assert.equal(urgent, null);
});
