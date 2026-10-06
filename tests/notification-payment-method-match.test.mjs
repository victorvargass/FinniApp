import assert from 'node:assert/strict';
import test from 'node:test';

import { findClosestPaymentMethod } from '../lib/notification-payment-method-match.ts';

const methods = [
  { id: 1, name: 'Coopeuch Vista', type: 'debit', active: true },
  { id: 2, name: 'Coopeuch Crédito', type: 'credit', active: true },
  { id: 3, name: 'Banco de Chile Débito', type: 'debit', active: true },
  { id: 4, name: 'MACH', type: 'prepaid', active: true },
  { id: 5, name: 'Coopeuch antigua', type: 'credit', active: false },
];

test('matches a bank app name and the detected card type', () => {
  const match = findClosestPaymentMethod({
    sourceApp: 'AppCoopeuch',
    paymentMethodHint: 'AppCoopeuch',
    suggestedPaymentMethodType: 'credit',
    suggestedType: 'expense',
  }, methods);

  assert.equal(match?.id, 2);
});

test('uses the Wallet instrument name instead of the Wallet application name', () => {
  const match = findClosestPaymentMethod({
    sourceApp: 'Google Wallet',
    paymentMethodHint: 'Banco Chile Débito',
    suggestedPaymentMethodType: 'debit',
    suggestedType: 'expense',
  }, methods);

  assert.equal(match?.id, 3);
});

test('does not guess when the closest result is ambiguous or unrelated', () => {
  assert.equal(findClosestPaymentMethod({
    sourceApp: 'Banco desconocido',
    suggestedPaymentMethodType: 'credit',
    suggestedType: 'expense',
  }, methods), null);

  assert.equal(findClosestPaymentMethod({
    sourceApp: 'AppCoopeuch',
    suggestedPaymentMethodType: null,
    suggestedType: 'expense',
  }, methods), null);
});

test('card payments only select a matching credit target', () => {
  const match = findClosestPaymentMethod({
    sourceApp: 'AppCoopeuch',
    suggestedType: 'card-payment',
  }, methods);

  assert.equal(match?.id, 2);
});
