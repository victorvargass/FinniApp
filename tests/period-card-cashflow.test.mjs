import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import {
  calculatePeriodAvailable,
  calculatePeriodOverviewExpenses,
  PERIOD_CARD_ADJUSTMENTS_SQL,
  PERIOD_CARD_PAYMENTS_SQL,
} from '../lib/period-card-cashflow.ts';

test('the home overview excludes credit purchases but keeps every other expense', () => {
  assert.equal(calculatePeriodOverviewExpenses([
    { amount: 30_000, paymentMethodType: 'credit' },
    { amount: 20_000, paymentMethodType: 'debit' },
    { amount: 10_000, paymentMethodType: 'cash' },
    { amount: 5_000, paymentMethodType: null },
  ]), 35_000);
});

test('a credit purchase affects period available only when paid from an account', () => {
  const overviewExpenses = calculatePeriodOverviewExpenses([
    { amount: 30_000, paymentMethodType: 'credit' },
  ]);

  assert.equal(calculatePeriodAvailable(100_000, overviewExpenses, 0, {
    paymentsFromAccounts: 30_000,
    internalAdjustments: 0,
  }), 70_000);
});

test('a non-credit purchase and an account-funded card payment each reduce period available', () => {
  assert.equal(calculatePeriodAvailable(100_000, 30_000, 0, {
    paymentsFromAccounts: 30_000,
    internalAdjustments: 0,
  }), 40_000);
});

test('an internal card refund restores period available without another expense', () => {
  assert.equal(calculatePeriodAvailable(100_000, 30_000, 0, {
    paymentsFromAccounts: 0,
    internalAdjustments: 30_000,
  }), 100_000);
  assert.equal(calculatePeriodAvailable(100_000, 30_000, 10_000, {
    paymentsFromAccounts: 20_000,
    internalAdjustments: 5_000,
  }), 65_000);
});

test('card payment and internal adjustment totals follow the movement date and period', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE periods (id INTEGER PRIMARY KEY, start_date TEXT, end_date TEXT);
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY, period_id INTEGER, amount INTEGER,
        credit_payment_target_id INTEGER
      );
      CREATE TABLE credit_card_adjustments (
        id INTEGER PRIMARY KEY, amount INTEGER, date TEXT
      );
      INSERT INTO periods VALUES (1, '2026-09-01', '2026-09-30');
      INSERT INTO periods VALUES (2, '2026-10-01', '2026-10-31');
      INSERT INTO expenses VALUES (1, 1, 30000, NULL);
      INSERT INTO expenses VALUES (2, 1, 20000, 7);
      INSERT INTO expenses VALUES (3, 2, 5000, 7);
      INSERT INTO credit_card_adjustments VALUES (1, 10000, '2026-09-30');
      INSERT INTO credit_card_adjustments VALUES (2, 2000, '2026-10-01');
    `);

    const payments = database.prepare(PERIOD_CARD_PAYMENTS_SQL).all();
    const adjustments = database.prepare(PERIOD_CARD_ADJUSTMENTS_SQL).all();
    assert.deepEqual(payments.map(({ periodId, total }) => [periodId, total]), [
      [1, 20000], [2, 5000],
    ]);
    assert.deepEqual(adjustments.map(({ periodId, total }) => [periodId, total]), [
      [1, 10000], [2, 2000],
    ]);

    database.exec('DELETE FROM credit_card_adjustments WHERE id = 1');
    assert.deepEqual(database.prepare(PERIOD_CARD_ADJUSTMENTS_SQL).all()
      .map(({ periodId, total }) => [periodId, total]), [[2, 2000]]);
  } finally {
    database.close();
  }
});
