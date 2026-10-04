import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const payments = readFileSync(new URL('../components/card-payment-movements.tsx', import.meta.url), 'utf8');
const transfers = readFileSync(new URL('../components/account-transfer-movements.tsx', import.meta.url), 'utf8');
const paymentMethod = readFileSync(new URL('../app/modal/payment-method-detail.tsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../app/modal/account-movement-detail.tsx', import.meta.url), 'utf8');
const list = readFileSync(new URL('../components/account-movement-list.tsx', import.meta.url), 'utf8');

test('card payments, adjustments and transfers open a read-only detail before their form', () => {
  assert.match(payments, /pathname: '\/modal\/account-movement-detail'/);
  assert.match(payments, /kind: isPayment \? 'payment' : 'adjustment'/);
  assert.match(transfers, /pathname: '\/modal\/account-movement-detail'/);
  assert.match(transfers, /kind: 'transfer'/);
  assert.match(paymentMethod, /kind: 'payment'/);
  assert.match(paymentMethod, /kind: 'adjustment'/);
  assert.match(paymentMethod, /kind: 'transfer'/);
});

test('account movement detail exposes edit and confirmed delete actions', () => {
  assert.match(detail, /<OverflowMenu/);
  assert.match(detail, /label: t\('common\.edit'\)/);
  assert.match(detail, /label: t\('common\.delete'\)/);
  assert.match(detail, /confirmDelete/);
  assert.match(detail, /pathname: '\/modal\/expense-form'/);
  assert.match(detail, /pathname: '\/modal\/account-transfer-form'/);
});

test('card payments, adjustments and transfers expose confirmed deletion from their rows', () => {
  assert.match(list, /movement\.onDelete/);
  assert.match(list, /name="trash-outline"/);
  assert.doesNotMatch(list, /name="chevron-forward"/);
  assert.match(list, /event\.stopPropagation\(\)/);
  assert.match(payments, /onDelete: \(\) => confirmDelete\(movement\)/);
  assert.match(payments, /removeExpense\(movement\.id\)/);
  assert.match(payments, /removeCreditCardAdjustment\(movement\.id\)/);
  assert.match(transfers, /onDelete: \(\) => confirmDelete\(transfer\.id\)/);
  assert.match(transfers, /removeAccountTransfer\(id\)/);
});
