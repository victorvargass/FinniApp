import assert from 'node:assert/strict';
import test from 'node:test';

import { getIncomeGroupIdentity } from '../lib/income-grouping.ts';

test('categorized income groups by its income category, not its payment method', () => {
  const income = {
    categoryId: 3, categoryName: 'Trabajo', categoryColor: '#123456',
    paymentMethodId: 7, paymentMethodColor: '#654321',
  };
  assert.deepEqual(getIncomeGroupIdentity(income, 'category', 'Banco', 'No especificado'), {
    key: 'category-3', name: 'Trabajo', color: '#123456',
  });
  assert.deepEqual(getIncomeGroupIdentity(income, 'payment-method', 'Banco', 'No especificado'), {
    key: 'payment-7', name: 'Banco', color: '#654321',
  });
});

test('old income without a category belongs to No especificado', () => {
  const income = {
    categoryId: null, categoryName: null, categoryColor: null,
    paymentMethodId: 7, paymentMethodColor: '#654321',
  };
  assert.equal(getIncomeGroupIdentity(income, 'category', 'Banco', 'No especificado').name, 'No especificado');
});
