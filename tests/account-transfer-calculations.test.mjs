import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getProjectedSourceBalance,
  getTransferableSourceBalance,
} from '../lib/account-transfer-calculations.ts';

test('transfer all uses the complete available source balance', () => {
  assert.equal(getTransferableSourceBalance(650_000, 1, null), 650_000);
  assert.equal(getProjectedSourceBalance(650_000, 1, 2, 650_000), 0);
});

test('editing a transfer restores its amount before calculating transfer all', () => {
  const existing = {
    amount: 120_000,
    sourcePaymentMethodId: 1,
    destinationPaymentMethodId: 2,
  };

  assert.equal(getTransferableSourceBalance(380_000, 1, existing), 500_000);
  assert.equal(getTransferableSourceBalance(220_000, 2, existing), 100_000);
});

test('transfer all remains unavailable without a reported balance', () => {
  assert.equal(getTransferableSourceBalance(null, 1, null), null);
  assert.equal(getProjectedSourceBalance(null, 1, 2, 10_000), null);
});
