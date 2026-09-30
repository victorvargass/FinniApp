import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGlobalSearchResults } from '../lib/global-search.ts';

const data = {
  expenses: [{ id: 1, name: 'Café histórico', amount: 2500, date: '2026-08-01', categoryName: 'Comida', paymentMethodName: 'Cuenta', savingsGoalName: null }],
  incomes: [{ id: 2, name: 'Sueldo septiembre', amount: 900000, date: '2026-09-25', categoryName: 'Sueldo', paymentMethodName: 'Cuenta', savingsGoalName: null }],
  contacts: [{ id: 3, name: 'María Pérez', nickname: 'Mari', relationshipTypeName: 'Amiga', email: null, phone: null, bankAccounts: [] }],
  debts: [{ id: 4, name: 'Préstamo María', creditor: null, contactName: 'María Pérez', contactNickname: 'Mari', notes: null, currentBalance: 30000, nextDueDate: '2026-10-05' }],
  debtPlans: [{ id: 5, name: 'Notebook', paymentMethodName: 'Tarjeta Azul', categoryName: 'Tecnología', remainingAmount: 150000, nextInstallmentDueDate: '2026-10-20' }],
  paymentMethods: [{ id: 6, name: 'Tarjeta Azul', type: 'credit', availableBalance: 350000 }],
  savingsGoals: [{ id: 7, name: 'Viaje Japón', currentAmount: 400000, deadline: '2027-01-10', status: 'archived' }],
};

test('global search finds every supported financial domain', () => {
  assert.deepEqual(buildGlobalSearchResults('cafe', data).map((item) => item.kind), ['expense']);
  assert.deepEqual(buildGlobalSearchResults('sueldo', data).map((item) => item.kind), ['income']);
  assert.deepEqual(buildGlobalSearchResults('mari', data).map((item) => item.kind), ['contact', 'debt']);
  assert.deepEqual(buildGlobalSearchResults('notebook', data).map((item) => item.kind), ['installment']);
  assert.deepEqual(buildGlobalSearchResults('tarjeta azul', data).map((item) => item.kind), ['payment-method', 'installment']);
  assert.deepEqual(buildGlobalSearchResults('japon', data).map((item) => item.kind), ['savings-goal']);
});

test('global search waits for two characters and prioritizes title prefixes', () => {
  assert.deepEqual(buildGlobalSearchResults('m', data), []);
  const results = buildGlobalSearchResults('maría', data);
  assert.equal(results[0].kind, 'contact');
  assert.equal(results[0].title, 'María Pérez');
});

test('global search applies a hard result limit', () => {
  const repeated = { ...data, expenses: Array.from({ length: 80 }, (_, index) => ({ ...data.expenses[0], id: index + 1, name: `Café ${index}` })) };
  assert.equal(buildGlobalSearchResults('cafe', repeated).length, 60);
  assert.equal(buildGlobalSearchResults('cafe', repeated, 10).length, 10);
});
