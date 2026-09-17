import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getHomePaymentMethods,
  groupPaymentMethodsByType,
  sumKnownAvailableBalances,
} from '../lib/payment-method-groups.ts';

test('payment methods are grouped in a predictable account order', () => {
  const groups = groupPaymentMethodsByType([
    { id: 1, type: 'credit', name: 'Card' },
    { id: 2, type: 'debit', name: 'Bank B' },
    { id: 3, type: 'cash', name: 'Cash' },
    { id: 4, type: 'prepaid', name: 'Wallet' },
    { id: 5, type: 'debit', name: 'Bank A' },
  ]);

  assert.deepEqual(groups.map((group) => group.type), ['cash', 'debit', 'prepaid', 'credit']);
  assert.deepEqual(groups[1].data.map((method) => method.id), [2, 5]);
});

test('empty payment method groups are omitted', () => {
  const groups = groupPaymentMethodsByType([{ id: 1, type: 'debit' }]);
  assert.deepEqual(groups.map((group) => group.type), ['debit']);
});

test('home separates active wallet balances from available credit', () => {
  const methods = [
    { id: 1, active: true, type: 'cash', availableBalance: 10_000 },
    { id: 2, active: true, type: 'debit', availableBalance: 20_000 },
    { id: 3, active: true, type: 'prepaid', availableBalance: null },
    { id: 4, active: true, type: 'credit', availableBalance: 50_000 },
    { id: 5, active: false, type: 'debit', availableBalance: 100_000 },
  ];

  const wallet = getHomePaymentMethods(methods, 'wallet');
  const credit = getHomePaymentMethods(methods, 'credit');

  assert.deepEqual(wallet.map((method) => method.id), [1, 2, 3]);
  assert.deepEqual(credit.map((method) => method.id), [4]);
  assert.equal(sumKnownAvailableBalances(wallet), 30_000);
  assert.equal(sumKnownAvailableBalances(credit), 50_000);
});
