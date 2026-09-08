import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateInstallmentAmounts,
  calculateNextPeriodDates,
} from '../lib/financial-calculations.ts';
import {
  extractCurrencyDigits,
  parseNonNegativeCurrency,
  parsePositiveCurrency,
} from '../lib/money.ts';

test('currency parser accepts formatted Chilean peso values and zero', () => {
  assert.equal(extractCurrencyDigits('$ 1.234.567'), '1234567');
  assert.equal(parsePositiveCurrency('$1.234'), 1234);
  assert.equal(parsePositiveCurrency('$0'), null);
  assert.equal(parseNonNegativeCurrency('$0'), 0);
  assert.equal(parseNonNegativeCurrency(''), null);
});

test('installments preserve the exact total without losing pesos', () => {
  const installments = calculateInstallmentAmounts(10_000, 3);
  assert.deepEqual(installments, [3333, 3333, 3334]);
  assert.equal(installments.reduce((sum, amount) => sum + amount, 0), 10_000);
});

test('next period begins the day after the current one', () => {
  assert.deepEqual(calculateNextPeriodDates('2026-01-31'), {
    startDate: '2026-02-01',
    endDate: '2026-03-01',
  });
});
