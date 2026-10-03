import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { findDuplicateMovement } from '../lib/movement-duplicate.ts';

test('duplicate matching ignores accents, casing and repeated whitespace', () => {
  const duplicate = findDuplicateMovement([
    { id: 1, name: 'Café   reunión', amount: 12_000, date: '2026-10-01', currency: 'CLP' },
  ], { name: ' cafe reunión ', amount: 12_000, currency: 'CLP' });

  assert.equal(duplicate?.id, 1);
});

test('duplicate matching requires the same amount and currency', () => {
  const candidates = [
    { id: 1, name: 'Compra', amount: 12_000, date: '2026-10-01', currency: 'CLP' },
  ];

  assert.equal(findDuplicateMovement(candidates, { name: 'Compra', amount: 11_000, currency: 'CLP' }), null);
  assert.equal(findDuplicateMovement(candidates, { name: 'Compra', amount: 12_000, currency: 'USD' }), null);
});

test('duplicate matching returns the most recent matching movement', () => {
  const duplicate = findDuplicateMovement([
    { id: 1, name: 'Sueldo', amount: 500_000, date: '2026-09-30', time: '12:00' },
    { id: 2, name: 'Sueldo', amount: 500_000, date: '2026-10-02', time: '08:00' },
  ], { name: 'Sueldo', amount: 500_000 });

  assert.equal(duplicate?.id, 2);
});

test('expense and income forms require confirmation before saving a duplicate', () => {
  const expenseForm = readFileSync(new URL('../components/forms/expense-form.tsx', import.meta.url), 'utf8');
  const incomeForm = readFileSync(new URL('../components/forms/income-form.tsx', import.meta.url), 'utf8');

  for (const form of [expenseForm, incomeForm]) {
    assert.match(form, /findDuplicateMovement/);
    assert.match(form, /t\('common\.saveAnyway'\)/);
  }
  assert.match(expenseForm, /t\('expenses\.duplicateQuestion'/);
  assert.match(incomeForm, /t\('incomes\.duplicateQuestion'/);
});
