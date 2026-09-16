import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateAvailableBalance,
  findUrgentCardPayment,
  getCardDueDate,
  getEstimatedPaymentDueDate,
} from '../lib/payment-method-calculations.ts';

test('available balance applies charges and card payments after the snapshot', () => {
  assert.equal(calculateAvailableBalance(1_000_000, 250_000, 80_000), 830_000);
  assert.equal(calculateAvailableBalance(50_000, 80_000, 0), -30_000);
});

test('a card payment after the reported balance date changes available credit', () => {
  assert.equal(calculateAvailableBalance(400_000, 0, 50_000), 450_000);
});

test('a reported zero balance still acts as a real payment-method snapshot', () => {
  assert.equal(calculateAvailableBalance(0, 0, 0), 0);
  assert.equal(calculateAvailableBalance(0, 0, 0, 0, 30_000), 30_000);
  assert.equal(calculateAvailableBalance(0, 12_000, 0), -12_000);
});

test('installment purchases consume their full total only once', () => {
  assert.equal(calculateAvailableBalance(1_000_000, 0, 0, 600_000), 400_000);
  assert.equal(calculateAvailableBalance(1_000_000, 100_000, 80_000, 600_000), 380_000);
});

test('income received after the snapshot increases the available balance', () => {
  assert.equal(calculateAvailableBalance(100_000, 30_000, 0, 0, 80_000), 150_000);
  assert.equal(calculateAvailableBalance(500_000, 25_000, 40_000, 100_000, 10_000), 425_000);
});

test('transfers move money without creating or destroying the combined balance', () => {
  const source = calculateAvailableBalance(100_000, 0, 0, 0, 0, 0, 25_000);
  const destination = calculateAvailableBalance(50_000, 0, 0, 0, 0, 25_000, 0);

  assert.equal(source, 75_000);
  assert.equal(destination, 75_000);
  assert.equal(source + destination, 150_000);
});

test('refunds and card adjustments restore available credit without spending another balance', () => {
  const available = calculateAvailableBalance(
    500_000,
    120_000,
    0,
    0,
    0,
    0,
    0,
    35_000
  );

  assert.equal(available, 415_000);
});

test('due date uses the next valid occurrence of the configured day', () => {
  assert.equal(getEstimatedPaymentDueDate('2026-09-18', 5).toISOString().slice(0, 10), '2026-10-05');
  assert.equal(getEstimatedPaymentDueDate('2026-09-18', 25).toISOString().slice(0, 10), '2026-09-25');
  assert.equal(getEstimatedPaymentDueDate('2026-01-31', 31).toISOString().slice(0, 10), '2026-02-28');
});

test('a card without a pending statement estimates the due date after the next billing date', () => {
  const result = getCardDueDate({
    billingDay: 19,
    billedAmount: 0,
    paymentDueDay: 2,
    statementDate: '2026-08-19',
  }, new Date(2026, 8, 15, 23));

  assert.equal(result?.date.toISOString().slice(0, 10), '2026-10-02');
  assert.equal(result?.estimated, true);
});

test('a pending statement keeps its real due date even when it is overdue', () => {
  const result = getCardDueDate({
    billingDay: 19,
    billedAmount: 120_000,
    paymentDueDay: 2,
    statementDate: '2026-08-19',
  }, new Date(2026, 8, 15));

  assert.equal(result?.date.toISOString().slice(0, 10), '2026-09-02');
  assert.equal(result?.estimated, false);
});

test('a billing date on the reference day still belongs to the current cycle', () => {
  const result = getCardDueDate({
    billingDay: 19,
    billedAmount: 0,
    paymentDueDay: 2,
    statementDate: null,
  }, new Date(2026, 8, 19, 23));

  assert.equal(result?.date.toISOString().slice(0, 10), '2026-10-02');
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
