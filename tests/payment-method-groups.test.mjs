import assert from 'node:assert/strict';
import test from 'node:test';

import { groupPaymentMethodsByType } from '../lib/payment-method-groups.ts';

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
